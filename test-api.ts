import { getGlobalFinancialStats } from './src/lib/actions/global-financial-stats';

async function main() {
  const data = await getGlobalFinancialStats("monthly");
  console.log(data);
}

main();
