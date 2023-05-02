import { IPriceProvider } from '../interfaces/price-provider.interface';

export class DataProviderData {
  public index!: number;
  public symbol!: string;
  public decimals!: number;
  public priceProvider!: IPriceProvider;
  public label!: string;
}
