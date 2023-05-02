import BN from 'bn.js';
import { PriceInfoStatusType } from '../enums/price-info.enum';

export class PriceInfo {
  private statues = [
    PriceInfoStatusType.Submitting,
    PriceInfoStatusType.Submitted,
    PriceInfoStatusType.Revealing,
    PriceInfoStatusType.Revealed,
  ];
  private readonly _epochId!: string;
  private readonly _priceSubmitted!: number;
  private readonly _random!: BN;
  private readonly _priceRevealed!: number;

  constructor(epochId: string, priceSubmitted: number, random: BN) {
    this._epochId = epochId;
    this._priceSubmitted = priceSubmitted;
    this._random = random;
  }

  public get epochId(): string {
    return this._epochId;
  }

  public get priceSubmitted(): number {
    return this._priceSubmitted;
  }

  public get random(): BN {
    return this._random;
  }

  private _status: PriceInfoStatusType = PriceInfoStatusType.Submitting;

  public get status(): string {
    return this._status;
  }

  public get priceRevealed(): number {
    return this._priceRevealed;
  }

  public moveToNextStatus(): void {
    const index = this.statues.indexOf(this._status);
    this._status = this.statues[index + 1];
  }

  public isSubmitting(): boolean {
    return this.isStatus(PriceInfoStatusType.Submitting);
  }

  public isSubmitted(): boolean {
    return this.isStatus(PriceInfoStatusType.Submitted);
  }

  public isRevealing(): boolean {
    return this.isStatus(PriceInfoStatusType.Revealing);
  }

  public isRevealed(): boolean {
    return this.isStatus(PriceInfoStatusType.Revealed);
  }

  private isStatus(status: string): boolean {
    return status == this.status;
  }
}
