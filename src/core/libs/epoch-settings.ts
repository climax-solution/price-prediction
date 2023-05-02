import { BigNumber } from 'ethers';

export class EpochSettings {
  private readonly _firstEpochStartTime: BigNumber;
  private readonly _submitPeriod: BigNumber;
  private readonly _revealPeriod: BigNumber;
  private readonly _firstEpochId: BigNumber = BigNumber.from(0);

  constructor(
    _firstEpochStartTime: BigNumber,
    _submitPeriod: BigNumber,
    _revealPeriod: BigNumber,
  ) {
    this._firstEpochStartTime = _firstEpochStartTime;
    this._submitPeriod = _submitPeriod;
    this._revealPeriod = _revealPeriod;
  }

  getCurrentEpochId(): BigNumber {
    return this.getEpochIdForTime(new Date().getTime());
  }

  getEpochSubmitTimeEnd(): BigNumber {
    const id: BigNumber = this.getCurrentEpochId()
      .add(BigNumber.from(1))
      .add(this._firstEpochId);
    return this._firstEpochStartTime.add(id.mul(this._submitPeriod));
  }

  getEpochRevealTimeEnd(): BigNumber {
    return this.getEpochSubmitTimeEnd().add(this._revealPeriod);
  }

  getRevealPeriod(): BigNumber {
    return this._revealPeriod;
  }

  getSubmitPeriod(): BigNumber {
    return this._submitPeriod;
  }

  private getEpochIdForTime(timeInMillis: number): BigNumber {
    const diff: BigNumber = BigNumber.from(timeInMillis).sub(
      this._firstEpochStartTime,
    );
    return this._firstEpochId.add(diff.div(this._submitPeriod));
  }
}
