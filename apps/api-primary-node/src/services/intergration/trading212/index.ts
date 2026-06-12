

import fetch from 'node-fetch';

const API_KEY = process.env.TRADING_212_API_KEY;

export async function getExchanges() {

  try {

    if (!API_KEY) {
      throw new Error('TRADING_212_API_KEY is not set');
    }

    const resp = await fetch(
      `https://live.trading212.com/api/v0/equity/metadata/exchanges`,
      {
        method: 'GET',
        headers: {
          Authorization: `${API_KEY}`,
          'User-Agent': 'Node.js',
          'Accept': 'application/json'
        },
      }
    );

    if (!resp.ok) {
      throw new Error('Failed to fetch exchanges');
    }
    const data = await resp.json();

    return data;
  } catch (error) {
    throw new Error('Failed to fetch exchanges');
  }
}

export async function getOpenPositions() {

  try {

    console.log("APIKEY", API_KEY);

    const resp = await fetch(
      `https://live.trading212.com/api/v0/equity/portfolio`,
      {
        method: 'GET',
        headers: {
          Authorization: `${API_KEY}`,
          'User-Agent': 'Node.js',
          'Accept': 'application/json'
        }
      }
    );

    console.log(resp) ;

    if (!resp.ok) {
      throw new Error('Failed to fetch exchanges');
    }

    const data = await resp.text();
    return data;
  } catch (error) {
    throw new Error('Failed to fetch open positions');
  }

}
