import { AssetsChange, AssetValue } from "@shared/schema";

/**
 * It is expected the the asset history items here have already been filtered
 * by the date range at the db level.
 */


// type AssetsChangeValues = {
//   startDate: Date;
//   endDate: Date;
//   startValue: number;
//   history: AssetValue[]
// }

// export const calculateAssetsChange = ({startDate, endDate, startValue, history}: AssetsChangeValues): AssetsChange => {



/**
 * Bond
 * Yes, a single bond can be split into multiple securities, particularly through a process called stripping. When a bond is stripped, its individual interest payments and the principal payment are separated and sold as individual securities, each with its own unique identifier (CUSIP). This allows investors to tailor their investments to specific cash flow needs or time horizons. 
 */


type Asset = {
  type: "broker" | "general" | "etf" | "crypto" | "bond";
}

type AssetGroup = {
  
}

type AssetHistoryStreamItem = 

async getAssetCombinedHistoryStream(assetId: Asset["id"]): Promise<Generator> {

}
