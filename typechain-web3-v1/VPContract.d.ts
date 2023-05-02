/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import BN from "bn.js";
import { ContractOptions } from "web3-eth-contract";
import { EventLog } from "web3-core";
import { EventEmitter } from "events";
import {
  Callback,
  PayableTransactionObject,
  NonPayableTransactionObject,
  BlockType,
  ContractEventLog,
  BaseContract,
} from "./types";

interface EventOptions {
  filter?: object;
  fromBlock?: BlockType;
  topics?: string[];
}

export type CreatedVotePowerCache = ContractEventLog<{
  _owner: string;
  _blockNumber: string;
  0: string;
  1: string;
}>;
export type Delegate = ContractEventLog<{
  from: string;
  to: string;
  priorVotePower: string;
  newVotePower: string;
  0: string;
  1: string;
  2: string;
  3: string;
}>;
export type Revoke = ContractEventLog<{
  delegator: string;
  delegatee: string;
  votePower: string;
  blockNumber: string;
  0: string;
  1: string;
  2: string;
  3: string;
}>;

export interface VPContract extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  ): VPContract;
  clone(): VPContract;
  methods: {
    batchVotePowerOfAt(
      _owners: string[],
      _blockNumber: number | string | BN
    ): NonPayableTransactionObject<string[]>;

    cleanupBlockNumber(): NonPayableTransactionObject<string>;

    delegate(
      _from: string,
      _to: string,
      _balance: number | string | BN,
      _bips: number | string | BN
    ): NonPayableTransactionObject<void>;

    delegateExplicit(
      _from: string,
      _to: string,
      _balance: number | string | BN,
      _amount: number | string | BN
    ): NonPayableTransactionObject<void>;

    delegatesOf(_owner: string): NonPayableTransactionObject<{
      _delegateAddresses: string[];
      _bips: string[];
      _count: string;
      _delegationMode: string;
      0: string[];
      1: string[];
      2: string;
      3: string;
    }>;

    delegatesOfAt(
      _owner: string,
      _blockNumber: number | string | BN
    ): NonPayableTransactionObject<{
      _delegateAddresses: string[];
      _bips: string[];
      _count: string;
      _delegationMode: string;
      0: string[];
      1: string[];
      2: string;
      3: string;
    }>;

    delegationModeOf(_who: string): NonPayableTransactionObject<string>;

    explicitDelegationHistoryCleanup(
      _from: string,
      _to: string,
      _count: number | string | BN
    ): NonPayableTransactionObject<string>;

    isReplacement(): NonPayableTransactionObject<boolean>;

    ownerToken(): NonPayableTransactionObject<string>;

    percentageDelegationHistoryCleanup(
      _owner: string,
      _count: number | string | BN
    ): NonPayableTransactionObject<string>;

    revocationCleanup(
      _from: string,
      _to: string,
      _blockNumber: number | string | BN
    ): NonPayableTransactionObject<string>;

    revokeDelegationAt(
      _from: string,
      _to: string,
      _balance: number | string | BN,
      _blockNumber: number | string | BN
    ): NonPayableTransactionObject<void>;

    setCleanerContract(
      _cleanerContract: string
    ): NonPayableTransactionObject<void>;

    setCleanupBlockNumber(
      _blockNumber: number | string | BN
    ): NonPayableTransactionObject<void>;

    setCleanupBlockNumberManager(
      _cbnManager: string
    ): NonPayableTransactionObject<void>;

    undelegateAll(
      _from: string,
      _balance: number | string | BN
    ): NonPayableTransactionObject<void>;

    undelegateAllExplicit(
      _from: string,
      _delegateAddresses: string[]
    ): NonPayableTransactionObject<string>;

    undelegatedVotePowerOf(
      _owner: string,
      _balance: number | string | BN
    ): NonPayableTransactionObject<string>;

    undelegatedVotePowerOfAt(
      _owner: string,
      _balance: number | string | BN,
      _blockNumber: number | string | BN
    ): NonPayableTransactionObject<string>;

    updateAtTokenTransfer(
      _from: string,
      _to: string,
      _fromBalance: number | string | BN,
      _toBalance: number | string | BN,
      _amount: number | string | BN
    ): NonPayableTransactionObject<void>;

    votePowerCacheCleanup(
      _owner: string,
      _blockNumber: number | string | BN
    ): NonPayableTransactionObject<string>;

    votePowerFromTo(
      _from: string,
      _to: string,
      _balance: number | string | BN
    ): NonPayableTransactionObject<string>;

    votePowerFromToAt(
      _from: string,
      _to: string,
      _balance: number | string | BN,
      _blockNumber: number | string | BN
    ): NonPayableTransactionObject<string>;

    votePowerHistoryCleanup(
      _owner: string,
      _count: number | string | BN
    ): NonPayableTransactionObject<string>;

    votePowerOf(_who: string): NonPayableTransactionObject<string>;

    votePowerOfAt(
      _who: string,
      _blockNumber: number | string | BN
    ): NonPayableTransactionObject<string>;

    votePowerOfAtCached(
      _who: string,
      _blockNumber: number | string | BN
    ): NonPayableTransactionObject<string>;

    votePowerOfAtIgnoringRevocation(
      _who: string,
      _blockNumber: number | string | BN
    ): NonPayableTransactionObject<string>;
  };
  events: {
    CreatedVotePowerCache(cb?: Callback<CreatedVotePowerCache>): EventEmitter;
    CreatedVotePowerCache(
      options?: EventOptions,
      cb?: Callback<CreatedVotePowerCache>
    ): EventEmitter;

    Delegate(cb?: Callback<Delegate>): EventEmitter;
    Delegate(options?: EventOptions, cb?: Callback<Delegate>): EventEmitter;

    Revoke(cb?: Callback<Revoke>): EventEmitter;
    Revoke(options?: EventOptions, cb?: Callback<Revoke>): EventEmitter;

    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter;
  };

  once(
    event: "CreatedVotePowerCache",
    cb: Callback<CreatedVotePowerCache>
  ): void;
  once(
    event: "CreatedVotePowerCache",
    options: EventOptions,
    cb: Callback<CreatedVotePowerCache>
  ): void;

  once(event: "Delegate", cb: Callback<Delegate>): void;
  once(event: "Delegate", options: EventOptions, cb: Callback<Delegate>): void;

  once(event: "Revoke", cb: Callback<Revoke>): void;
  once(event: "Revoke", options: EventOptions, cb: Callback<Revoke>): void;
}
