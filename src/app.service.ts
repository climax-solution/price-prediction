import { Injectable } from '@nestjs/common';
import { BigNumber, Contract } from 'ethers';
import * as ccxws from 'ccxws';
import Web3 from 'web3';

import { PriceSubmitter } from '../typechain-web3-v1/PriceSubmitter';
import { FtsoManager } from '../typechain-web3-v1/FtsoManager';
import { VoterWhitelister } from '../typechain-web3-v1/VoterWhitelister';
import { FtsoRegistry } from '../typechain-web3-v1/FtsoRegistry';
import { EpochSettings } from './core/libs/epoch-settings';
import { PriceInfo } from './core/libs/price-info';
import { WebsocketLimitedPriceProvider } from './core/libs/websocket-limited-price-provider';
import {
  bigNumberToMillisecond,
  getContract,
  getLogger,
  getProvider,
  getWeb3Contract,
  getWeb3Wallet,
  priceHash,
  waitFinalize3Factory,
} from './core/utils/web3.util';
import { DataProviderData } from './core/models/data-provider.model';
import { ContractWithSymbol } from './core/interfaces/web3.interface';
import { DATA_PROVIDER_CONFIG } from './core/constants/base.constant';
import { IPriceProvider } from './core/interfaces/price-provider.interface';

@Injectable()
export class AppService {
  logger = getLogger();

  web3: Web3;
  account: any;
  provider: any;

  priceSubmitterWeb3Contract!: PriceSubmitter;
  priceSubmitterContract: any;
  ftsoManagerWeb3Contract!: FtsoManager;
  ftsoManagerContract!: Contract;
  voterWhitelisterContract!: VoterWhitelister;
  ftsoRegistryContract!: FtsoRegistry;

  ftsosCount!: number;
  ftso2symbol: Map<string, string> = new Map();
  symbol2Index: Map<string, any> = new Map();
  symbol2dpd: Map<string, DataProviderData> = new Map();
  ftsoContracts: ContractWithSymbol[] = [];

  waitFinalize3: any;

  epochSettings!: EpochSettings;
  nonce: number | undefined; // if undefined, we retrieve it from blockchain, otherwise we use it
  nonceResetCount!: number;
  forcedNonceResetOn = 1;
  symbol2epochId2priceInfo: Map<string, Map<string, PriceInfo>> = new Map();

  epochId2endRevealTime: Map<string, number> = new Map();
  functionsToExecute: any[] = [];

  currentBitmask = 0;
  ex2client: any = {};

  data!: DataProviderData[];

  constructor() {
    const providerLength: number =
      DATA_PROVIDER_CONFIG.priceProviderList.length;
    this.web3 = new Web3(DATA_PROVIDER_CONFIG.rpcUrl);
    const exchanges: any[] = [];
    for (const ex of ['coinbasepro', 'ftx', 'kraken']) {
      exchanges.push({
        ex,
        market: 'USDT/USD',
        client: this.getWebsocketClient(ex, 3 * providerLength),
      });
    }
    const usdtUsdProvider: IPriceProvider = new WebsocketLimitedPriceProvider(
      'USDT/USD',
      1.0,
      exchanges,
      'avg',
    );
    usdtUsdProvider.setLogger(this.logger);
    usdtUsdProvider.init();

    // providers from config
    this.data = DATA_PROVIDER_CONFIG.priceProviderList.map(
      (ppc: any, index: number) => {
        ppc.priceProviderParams[2] = ppc.priceProviderParams[2].map(
          (arr: any) => {
            const ex: string = arr[0];
            return {
              ex,
              market: arr[1],
              client: this.getWebsocketClient(ex, 2 * providerLength),
            };
          },
        );
        const priceProvider: IPriceProvider = new WebsocketLimitedPriceProvider(
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          ...ppc.priceProviderParams,
        );
        priceProvider.setLogger(this.logger);
        priceProvider.setUsdtUsdProvider(usdtUsdProvider);
        priceProvider.init();
        const dpd = {
          index: index,
          symbol: ppc.symbol,
          decimals: ppc.decimals,
          priceProvider,
          label: ppc.priceProviderClass + '(' + ppc.symbol + '/USD)',
        } as DataProviderData;
        this.symbol2dpd.set(ppc.symbol, dpd);
        return dpd;
      },
    );

    this.provider = getProvider(DATA_PROVIDER_CONFIG.rpcUrl);

    if (this.data.length == 0) {
      throw Error('No price providers in configuration!');
    }

    this.nonceResetCount = this.forcedNonceResetOn;

    this.data.forEach((d) => {
      this.symbol2epochId2priceInfo.set(d.symbol, new Map());
    });
    this.runDataProvider().then();
  }

  getWebsocketClient(ex: string, n: number): void {
    if (!this.ex2client[ex]) {
      const client: any = new (ccxws as any)[ex]();
      client.setMaxListeners(n);
      client.on('error', (err: any) =>
        this.logger.error(`Error on exchange ${ex}: ${err}`),
      );
      client.on('reconnecting', () =>
        this.logger.info(`Reconnecting to ${ex}...`),
      );
      client.on('connecting', () => this.logger.info(`Connecting to ${ex}...`));
      client.on('connected', () => this.logger.info(`Connected to ${ex}...`));
      client.on('disconnected', () =>
        this.logger.info(`Disconnected from ${ex}...`),
      );
      client.on('closing', () => this.logger.info(`Closing on ${ex}...`));
      client.on('closed', () => this.logger.info(`Closed on ${ex}...`));
      this.ex2client[ex] = client;
    }
    return this.ex2client[ex];
  }

  async getNonce(): Promise<string> {
    this.nonceResetCount--;
    if (this.nonce && this.nonceResetCount > 0) {
      this.nonce++;
    } else {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.nonce = await this.web3.eth.getTransactionCount(
        this.account.address,
      );
      this.nonceResetCount = this.forcedNonceResetOn;
    }
    return this.nonce + ''; // string returned
  }

  resetNonce() {
    this.nonce = undefined;
  }

  getRandom() {
    return Web3.utils.toBN(Web3.utils.randomHex(32));
  }

  preparePrice(price: number, decimals: number) {
    return Math.floor(price * 10 ** decimals);
  }

  async signAndFinalize3(
    label: string,
    toAddress: string,
    fnToEncode: any,
    gas = '2500000',
  ): Promise<boolean> {
    const nonce = await this.getNonce();
    const tx = {
      from: this.account.address,
      to: toAddress,
      gas: gas,
      gasPrice: DATA_PROVIDER_CONFIG.gasPrice,
      data: fnToEncode.encodeABI(),
      nonce: nonce,
    };
    const signedTx = await this.account.signTransaction(tx);

    try {
      await this.waitFinalize3(this.account.address, () =>
        this.web3.eth.sendSignedTransaction(signedTx.rawTransaction!),
      );
      return true;
    } catch (e: any) {
      if (e.message.indexOf('Transaction has been reverted by the EVM') < 0) {
        this.logger.error(
          `${label} | Nonce sent: ${nonce} | signAndFinalize3 error: ${e.message}`,
        );
        this.resetNonce();
      } else {
        fnToEncode
          .call({ from: this.account.address })
          .then((result: any) => {
            throw Error('unlikely to happen: ' + JSON.stringify(result));
          })
          .catch((revertReason: any) => {
            this.logger.error(
              `${label} | Nonce sent: ${nonce} | signAndFinalize3 error: ${revertReason}`,
            );
            this.resetNonce();
          });
      }
      return false;
    }
  }

  supportedSymbols() {
    return Array.from(this.symbol2Index.keys()).join(', ');
  }

  isSymbolActive(bitmask: number, symbol: string) {
    const index = this.symbol2Index.get(symbol);
    return index >= 0 && (bitmask >> index) % 2 == 1;
  }

  async submitPriceHash(lst: DataProviderData[]) {
    this.logger.info('SUBMITTING');
    const epochId = this.epochSettings.getCurrentEpochId().toString();
    const realEpochData = await this.ftsoManagerWeb3Contract.methods
      .getCurrentPriceEpochData()
      .call();
    this.logger.info(
      `Internal epoch id: ${epochId}, real ${realEpochData._priceEpochId}`,
    );

    const index2price: Map<number, number> = new Map();
    const random = this.getRandom();
    this.currentBitmask = (await this.priceSubmitterWeb3Contract.methods
      .voterWhitelistBitmap(this.account.address)
      .call()) as any;
    this.logger.info(`Current bitmask: ${this.currentBitmask.toString(2)}`);

    for (let p of lst) {
      p = p as DataProviderData;
      if (!this.symbol2Index.has(p.symbol)) {
        this.logger.info(
          `Skipping submit of ${
            p.symbol
          } since it is not supported (no FTSO found). Supported symbols are: ${this.supportedSymbols()}.`,
        );
        continue;
      }
      if (
        !this.isSymbolActive(this.currentBitmask, p.symbol) &&
        !DATA_PROVIDER_CONFIG.trusted
      ) {
        this.logger.info(
          `Skipping submit of ${p.symbol} since it is not whitelisted`,
        );
        continue;
      }

      const price = await p.priceProvider.getPrice();
      if (price) {
        const preparedPrice = this.preparePrice(price, p.decimals);
        index2price.set(Number(this.symbol2Index.get(p.symbol)), preparedPrice);
        this.logger.info(
          `${p.label} | Submitting price: ${(
            preparedPrice /
            10 ** p.decimals
          ).toFixed(p.decimals)} $ for ${epochId}`,
        );
        this.symbol2epochId2priceInfo
          .get(p.symbol)!
          .set(epochId, new PriceInfo(epochId, preparedPrice, random));
      } else {
        this.logger.error(`No price for ${p.symbol}`);
      }
    }

    const ftsoIndices: number[] = [...index2price.keys()].sort(
      (a: number, b: number) => a - b,
    );
    const prices: string[] = ftsoIndices.map((index: number) =>
      index2price.get(index)!.toString(),
    );

    if (prices.length > 0) {
      this.logger.info(
        `Ftso indices: ${ftsoIndices.map((x) => x.toString()).toString()}`,
      );
      const hash = priceHash(
        this.web3,
        ftsoIndices,
        prices,
        random,
        this.account.address,
      );
      const fnToEncode = this.priceSubmitterWeb3Contract.methods.submitHash(
        epochId,
        hash,
      );
      await this.signAndFinalize3(
        'Submit prices',
        this.priceSubmitterWeb3Contract.options.address,
        fnToEncode,
        '2500000',
      );
    }
  }

  async revealPrices(
    lst: DataProviderData[],
    epochId: BigNumber,
  ): Promise<void> {
    this.logger.info('REVEALING');
    const epochIdStr: string = epochId.toString();
    while (
      this.epochId2endRevealTime.get(epochIdStr) &&
      new Date().getTime() < this.epochId2endRevealTime.get(epochIdStr)!
    ) {
      // let addresses = [];
      let random = Web3.utils.toBN('0');
      const index2price: Map<number, number> = new Map();

      for (let p of lst) {
        p = p as DataProviderData;
        if (!this.symbol2Index.get(p.symbol)) {
          this.logger.info(
            `Skipping reveal of ${
              p.symbol
            } since it is not supported (no FTSO found). Supported symbols are: ${this.supportedSymbols()}.`,
          );
          continue;
        }

        const priceInfo = this.symbol2epochId2priceInfo
          .get(p.symbol)!
          .get(epochIdStr);

        if (priceInfo) {
          this.logger.info(`${p.label} | Revealing price for ${epochIdStr}`);
          priceInfo.moveToNextStatus();
          index2price.set(
            Number(this.symbol2Index.get(p.symbol)),
            priceInfo.priceSubmitted,
          );
          random = priceInfo.random;
        }
      }

      const ftsoIndices: number[] = [...index2price.keys()].sort(
        (a: number, b: number) => a - b,
      );
      const prices: string[] = ftsoIndices.map((index: number) =>
        index2price.get(index)!.toString(),
      );

      if (prices.length > 0) {
        const fnToEncode = this.priceSubmitterWeb3Contract.methods.revealPrices(
          epochIdStr,
          ftsoIndices,
          prices,
          random,
        );
        await this.signAndFinalize3(
          'Reveal prices',
          this.priceSubmitterWeb3Contract.options.address,
          fnToEncode,
          '2500000',
        );
        break;
      }

      await new Promise((resolve: any) => {
        setTimeout(() => {
          resolve();
        }, 1000);
      });
    }
  }

  execute(func: () => any) {
    this.functionsToExecute.push(func);
  }

  async runExecution() {
    this.logger.info(`RPC: ${DATA_PROVIDER_CONFIG.rpcUrl}`);
    while (true) {
      if (this.functionsToExecute.length > 0) {
        const func: any = this.functionsToExecute.shift();
        try {
          await func();
        } catch (e: any) {
          this.logger.error('TX fail: ' + e.message + ' | Stack: ' + e.stack);
        }
      } else {
        await new Promise((resolve: any) => {
          setTimeout(() => {
            resolve();
          }, 500);
        });
      }
    }
  }

  async setupSubmissionAndReveal() {
    const epochId: BigNumber = this.epochSettings.getCurrentEpochId();
    const epochSubmitTimeEnd: number = this.epochSettings
      .getEpochSubmitTimeEnd()
      .toNumber();
    const epochRevealTimeEnd: number = this.epochSettings
      .getEpochRevealTimeEnd()
      .toNumber();
    const now = new Date().getTime();
    const diffSubmit = epochSubmitTimeEnd - now;
    const revealPeriod = this.epochSettings.getRevealPeriod().toNumber();
    const submitPeriod = this.epochSettings.getSubmitPeriod().toNumber();
    this.epochId2endRevealTime.set(epochId.toString(), epochRevealTimeEnd);

    this.logger.info(
      '+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++',
    );
    this.logger.info(
      `EPOCH DATA: epoch ${epochId} submit will end in: ${diffSubmit}ms, reveal in: ${
        diffSubmit + revealPeriod
      }ms, submitPeriod: ${submitPeriod}ms, revealPeriod: ${revealPeriod}ms`,
    );
    setTimeout(() => {
      this.logger.info(`SUBMIT ENDED FOR: ${epochId}`);
    }, epochSubmitTimeEnd - new Date().getTime());

    setTimeout(() => {
      this.logger.info(`REVEAL ENDED FOR: ${epochId}`);
    }, epochRevealTimeEnd - new Date().getTime());

    if (
      diffSubmit > submitPeriod - DATA_PROVIDER_CONFIG.submitOffset &&
      this.ftso2symbol.size >= this.ftsosCount
    ) {
      setTimeout(() => {
        this.logger.info(
          `Submit in ${
            diffSubmit - submitPeriod + DATA_PROVIDER_CONFIG.submitOffset
          }ms`,
        );
        this.execute(async () => {
          await this.submitPriceHash(this.data);
        });
      }, diffSubmit - submitPeriod + DATA_PROVIDER_CONFIG.submitOffset);

      setTimeout(() => {
        this.logger.info(
          `Reveal in ${diffSubmit + DATA_PROVIDER_CONFIG.revealOffset}ms`,
        );
        this.execute(async () => {
          await this.revealPrices(this.data, epochId);
        });
      }, diffSubmit + DATA_PROVIDER_CONFIG.revealOffset);
    }

    setTimeout(() => this.setupSubmissionAndReveal(), diffSubmit);
  }

  setupEvents() {
    this.priceSubmitterContract.on(
      'HashSubmitted',
      async (submitter: string, epochId: any, hash: string, timestamp: any) => {
        if (submitter != this.account.address) return;

        this.logger.info(`Prices submitted in epoch ${epochId.toString()}`);
      },
    );

    this.priceSubmitterContract.on(
      'PricesRevealed',
      async (
        voter: string,
        epochId: any,
        ftsos: string[],
        prices: any[],
        random: string,
        timestamp: any,
      ) => {
        if (voter != this.account.address) return;

        const epochIdStr = epochId.toString();
        let i = 0;
        for (const ftso of ftsos) {
          const symbol = this.ftso2symbol.get(ftso)!;
          const p: DataProviderData = this.symbol2dpd.get(symbol)!;
          const price = prices[i];

          this.logger.info(
            `${p.label} | Price revealed in epoch ${epochIdStr}: ${(
              price /
              10 ** p.decimals
            ).toFixed(p.decimals)}$.`,
          );

          const priceInfo = this.symbol2epochId2priceInfo
            .get(symbol)
            ?.get(epochIdStr);
          if (priceInfo) {
            priceInfo.moveToNextStatus();
            if (p) {
              this.logger.info(
                `${p.label} | Price that was submitted: ${(
                  priceInfo.priceSubmitted /
                  10 ** 5
                ).toFixed(5)}$`,
              );
              if (priceInfo.priceSubmitted != (price as number)) {
                this.logger.error(
                  `${p.label} | Price submitted and price revealed are different!`,
                );
              }
            }
          }
          i++;
        }
      },
    );

    this.ftsoContracts.forEach((contractWithSymbol) => {
      contractWithSymbol.contract.on(
        'PriceFinalized',
        async (
          epochId: any,
          price: any,
          rewardedFtso: boolean,
          lowRewardPrice: any,
          highRewardPrice: any,
          finalizationType: any,
          timestamp: any,
        ) => {
          this.logger.info(
            `Price finalized for ${
              contractWithSymbol.symbol
            } in epochId ${epochId}: price: ${(price / 10 ** 5).toFixed(
              5,
            )}$,  finalization type: ${finalizationType}, rewarded: ${rewardedFtso}, low price: ${(
              lowRewardPrice /
              10 ** 5
            ).toFixed(5)}$, high price: ${(highRewardPrice / 10 ** 5).toFixed(
              5,
            )}$, timestamp: ${timestamp.toString()}`,
          );
        },
      );
    });

    this.ftsoManagerContract.on(
      'RewardEpochFinalized',
      async (votePowerBlock: any, startBlock: any) => {
        this.logger.info(
          `Reward epoch finalized. New reward epoch starts with block ${startBlock}, uses vote power block ${votePowerBlock}`,
        );
      },
    );
  }

  async runDataProvider() {
    this.logger.info(`Starting Flare Price Provider`);
    const accountPrivateKey = DATA_PROVIDER_CONFIG.accountPrivateKey;

    this.waitFinalize3 = waitFinalize3Factory(this.web3);
    this.account = getWeb3Wallet(this.web3, accountPrivateKey);

    this.priceSubmitterWeb3Contract = await getWeb3Contract(
      this.web3,
      DATA_PROVIDER_CONFIG.priceSubmitterContractAddress,
      'PriceSubmitter',
    );
    this.priceSubmitterContract = await getContract(
      this.provider,
      DATA_PROVIDER_CONFIG.priceSubmitterContractAddress,
      'PriceSubmitter',
    );
    this.runExecution().then();

    try {
      const ftsoManagerAddress = await this.priceSubmitterWeb3Contract.methods
        .getFtsoManager()
        .call();
      this.logger.info(`FtsoManager address obtained ${ftsoManagerAddress}`);
      this.ftsoManagerWeb3Contract = await getWeb3Contract(
        this.web3,
        ftsoManagerAddress,
        'FtsoManager',
      );
      this.ftsoManagerContract = await getContract(
        this.provider,
        ftsoManagerAddress,
        'FtsoManager',
      );
    } catch (err: any) {
      this.logger.error(`getFtsoManager() | ${err}`);
      return; // No point in continuing without ftso manager
    }

    try {
      const ftsoRegistryAddress = await this.priceSubmitterWeb3Contract.methods
        .getFtsoRegistry()
        .call();
      this.logger.info(`FtsoRegistry address obtained ${ftsoRegistryAddress}`);
      this.ftsoRegistryContract = await getWeb3Contract(
        this.web3,
        ftsoRegistryAddress,
        'FtsoRegistry',
      );
    } catch (err: any) {
      this.logger.error(`ftsoRegistry() | ${err}`);
      return; // No point in continuing without ftso registry
    }

    // 2. get ftsos
    try {
      const voterWhitelisterAddress =
        await this.priceSubmitterWeb3Contract.methods
          .getVoterWhitelister()
          .call();
      this.logger.info(`VoterWhitelisterAddress: ${voterWhitelisterAddress}`);
      this.voterWhitelisterContract = await getWeb3Contract(
        this.web3,
        voterWhitelisterAddress,
        'VoterWhitelister',
      );

      try {
        const lst = await this.ftsoManagerWeb3Contract.methods
          .getFtsos()
          .call();
        this.ftsosCount = lst.length;
        for (const ftso of lst) {
          const contract = await getWeb3Contract(this.web3, ftso, 'Ftso');
          try {
            const symbol = await contract.methods.symbol().call();
            this.ftsoContracts.push({
              symbol,
              contract: await getContract(this.provider, ftso, 'Ftso'),
            });
            this.logger.info(`Symbol: ${symbol}`);
            this.ftso2symbol.set(ftso, symbol);
            const index = await this.ftsoRegistryContract.methods
              .getFtsoIndex(symbol)
              .call();
            this.logger.info(`INDEX: ${index.toString()}`);
            this.symbol2Index.set(symbol, index);
            if (DATA_PROVIDER_CONFIG.whitelist) {
              try {
                const fnToEncode =
                  this.voterWhitelisterContract.methods.requestWhitelistingVoter(
                    this.account.address,
                    index,
                  );
                await this.signAndFinalize3(
                  'Whitelist',
                  this.voterWhitelisterContract.options.address,
                  fnToEncode,
                  '2500000',
                );
                this.logger.info(`${symbol} whitelisted.`);
              } catch (err: any) {
                this.logger.error(
                  `symbol() | requestWhitelistingVoter() | ${err}`,
                );
              }
            }
          } catch (err: any) {
            this.logger.error(`symbol() | ${err}`);
          }
        }
      } catch (err: any) {
        this.logger.error(`getFtsos() | ${err}`);
      }
    } catch (err: any) {
      this.logger.error(`priceSubmitter() | ${err}`);
    }

    try {
      const data = (await this.ftsoManagerWeb3Contract.methods
        .getPriceEpochConfiguration()
        .call()) as any;
      this.epochSettings = new EpochSettings(
        bigNumberToMillisecond(data[0]),
        bigNumberToMillisecond(data[1]),
        bigNumberToMillisecond(data[2]),
      );
      await this.setupSubmissionAndReveal();
    } catch (err: any) {
      this.logger.error(`getPriceEpochConfiguration() | ${err}`);
    }

    this.setupEvents();
  }
}
