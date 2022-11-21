import BigNumber from 'bignumber.js';
import { assert } from 'ts-essentials';
import { AbstractStateTracker } from './AbstractStateTracker';
import BPTStateTracker from './BPTStateTracker';
import ERC20StateTracker from './ERC20StateTracker';

type V2Params = {
  sePSP1: string;
  sePSP2: string;
  bpt: string;
  poolId: string;
};
const config: {
  [chainId: number]: V2Params;
} = {
  5: {
    sePSP1: '',
    sePSP2: '',
    bpt: '',
    poolId: '',
  },
};

const SEPSP2_PSP_MULTIPLIER = 2.5;

export class StakeV2Resolver extends AbstractStateTracker {
  sePSP1Tracker: ERC20StateTracker;
  sePSP2Tracker: ERC20StateTracker;
  bptTracker: BPTStateTracker;
  static instance: { [chainId: string]: StakeV2Resolver };

  constructor(protected chainId: number) {
    super(chainId);
    const { sePSP1, sePSP2 } = config[chainId] || {};
    assert(sePSP1);
    assert(sePSP2);

    this.sePSP1Tracker = ERC20StateTracker.getInstance(chainId, sePSP1);
    this.sePSP2Tracker = ERC20StateTracker.getInstance(chainId, sePSP2);
    this.bptTracker = BPTStateTracker.getInstance(chainId);
  }

  static getInstance(chainId: number) {
    if (!this.instance[chainId]) {
      this.instance[chainId] = new StakeV2Resolver(chainId);
    }

    return this.instance[chainId];
  }

  async loadWithinInterval(startTimestamp: number, endTimestamp: number) {
    await this.resolveBlockBoundary({ startTimestamp, endTimestamp });

    const boundary = this.getBlockTimeBoundary();
    assert(
      boundary.startTimestamp === startTimestamp &&
        boundary.endTimestamp == endTimestamp,
      'wrong boundary resolved',
    );

    this.sePSP1Tracker.setBlockTimeBoundary(boundary);
    this.sePSP2Tracker.setBlockTimeBoundary(boundary);
    this.bptTracker.setBlockTimeBoundary(boundary);
  }

  getStakeForRefund(timestamp: number, account: string): BigNumber {
    this.assertTimestampWithinLoadInterval(timestamp);

    const sePSP1Balance = this.sePSP1Tracker.getBalance(timestamp, account);
    const sePSP2Balance = this.sePSP2Tracker.getBalance(timestamp, account);
    const { pspBalance: bptPSPBalance, totalSupply: bptTotalSupply } =
      this.bptTracker.getBPTState(timestamp);

    const pspInSePSP2 = sePSP2Balance // 1 BPT = 1 sePSP2
      .multipliedBy(bptPSPBalance)
      .dividedBy(bptTotalSupply);

    const stake = sePSP1Balance.plus(
      pspInSePSP2.multipliedBy(SEPSP2_PSP_MULTIPLIER),
    );

    return stake;
  }
}
