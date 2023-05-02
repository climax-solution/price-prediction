import { Contract } from 'ethers';

export interface ContractWithSymbol {
  symbol: string;
  contract: Contract;
}