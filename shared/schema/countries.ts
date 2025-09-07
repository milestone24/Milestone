export type {
  ICountry,
  ICountryData,
  ILanguage,
  TContinentCode,
  TCountryCode,
  TLanguageCode,
} from "countries-list";

import { continents, countries, languages } from "countries-list";
// Utils
import {
  getCountryCode,
  getCountryData,
  getCountryDataList,
  getEmojiFlag,
} from "countries-list";

const countriesOptions = Object.entries(countries)
  .map(([code, country]) => ({
    value: code,
    label: country.name,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

export {
  countries,
  countriesOptions,
  continents,
  languages,
  getCountryCode,
  getCountryData,
  getCountryDataList,
  getEmojiFlag,
};
