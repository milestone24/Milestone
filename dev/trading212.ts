import dotenv from 'dotenv';

dotenv.config({
  path: '.local.env'
});

import { getExchanges, getOpenPositions } from '../apps/api-primary-node/src/services/intergration/trading212';

// const exchanges = await getExchanges()
// .catch(err => {
//   console.log("Error fetching exchanges");
//   console.error(err);
// });

// console.log(exchanges);

(async () => {
  const openPositions = await getOpenPositions().catch((err) => {
    console.log("Error fetching open positions");
    console.error(err);
  });

  console.log(JSON.stringify(openPositions, null, 2));
})();
