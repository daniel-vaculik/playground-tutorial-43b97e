declare module "@parity/product-sdk-contracts" {
  export class ContractManager {
    static fromLiveClient(
      cdmJson: any,
      client: any,
      descriptor: any,
      options: any,
    ): Promise<ContractManager>;
    getContract(name: string): any;
  }
}

declare module "@parity/product-sdk-descriptors/paseo-asset-hub" {
  export const paseo_asset_hub: any;
}
