import BN from 'bn.js';
import { BigNumber, ethers } from 'ethers';
import * as fs from 'fs';
import glob from 'glob';
import * as winston from 'winston';

export function getProvider(rpcLink: string): ethers.providers.Provider {
  return new ethers.providers.JsonRpcProvider(rpcLink);
}

export function getAbi(abiPath: string) {
  let abi = JSON.parse(fs.readFileSync(abiPath).toString());
  if (abi.abi) {
    abi = abi.abi;
  }
  return abi;
}

export async function getWeb3Contract(
  web3: any,
  address: string,
  name: string,
) {
  const abiPath = await relativeContractABIPathForContractName(name);
  return new web3.eth.Contract(getAbi(`artifacts/${abiPath}`), address);
}

export async function getContract(
  provider: any,
  address: string,
  name: string,
) {
  const abiPath = await relativeContractABIPathForContractName(name);
  return new ethers.Contract(address, getAbi(`artifacts/${abiPath}`), provider);
}

export function getWeb3Wallet(web3: any, privateKey: string) {
  if (privateKey.indexOf('0x') != 0) {
    privateKey = '0x' + privateKey;
  }
  return web3.eth.accounts.privateKeyToAccount(privateKey);
}

export function getWallet(privateKey: string, provider: any): ethers.Wallet {
  return new ethers.Wallet(privateKey, provider);
}

export function waitFinalize3Factory(web3: any) {
  return async function (address: string, func: () => any, delay = 1000) {
    const nonce = await web3.eth.getTransactionCount(address);
    const res = await func();
    const backoff = 1.5;
    let cnt = 0;
    while ((await web3.eth.getTransactionCount(address)) == nonce) {
      await new Promise((resolve: any) => {
        setTimeout(() => {
          resolve();
        }, delay);
      });
      if (cnt < 8) {
        delay = Math.floor(delay * backoff);
        cnt++;
      } else {
        throw new Error('Response timeout');
      }
      console.log(`Delay backoff ${delay} (${cnt})`);
    }
    return res;
  };
}

export function getLogger(
  label: string | undefined = undefined,
  filename: string | undefined = undefined,
) {
  return winston.createLogger({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
      winston.format.label({
        label: label,
      }),
      winston.format.printf((json: any) => {
        if (json.label) {
          return `${json.timestamp} - ${json.label}:[${json.level}]: ${json.message}`;
        } else {
          return `${json.timestamp} - [${json.level}]: ${json.message}`;
        }
      }),
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({
        level: 'info',
        filename: filename || './logs/flare-price-provider.log',
      }),
    ],
  });
}

export function bigNumberToMillisecond(num: number) {
  return BigNumber.from(num * 1000);
}

export function priceHash(
  web3: any,
  ftsoIndices: (string | number | BN | BigNumber)[],
  prices: (string | number | BN | BigNumber)[],
  random: number | BN | BigNumber,
  address: string,
): string {
  return ethers.utils.keccak256(
    web3.eth.abi.encodeParameters(
      ['uint256[]', 'uint256[]', 'uint256', 'address'],
      [ftsoIndices, prices, random, address],
    ),
  );
}

export async function relativeContractABIPathForContractName(
  name: string,
  artifactsRoot = 'artifacts',
): Promise<any> {
  return new Promise((resolve, reject) => {
    glob(
      `contracts/**/${name}.sol/${name}.json`,
      { cwd: artifactsRoot },
      (er: any, files: string[] | null) => {
        if (er) {
          reject(er);
        } else {
          if (files && files.length === 1) {
            resolve(files[0]);
          } else {
            reject(files);
          }
        }
      },
    );
  });
}
