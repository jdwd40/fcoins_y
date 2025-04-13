import { LineData, CandlestickData } from 'lightweight-charts';

// Helper to get the 'close' price from candlestick data
const getClose = (data: CandlestickData) => data.close;

/**
 * Calculates the Simple Moving Average (SMA) for a given period.
 * @param data Candlestick data array, sorted by time ascending.
 * @param period The number of data points to include in the average.
 * @returns Array of LineData points representing the SMA.
 */
export function calculateMA(data: CandlestickData[], period: number): LineData[] {
  if (period <= 0 || data.length < period) {
    return [];
  }

  const result: LineData[] = [];
  let sum = 0;

  // Calculate sum for the first period
  for (let i = 0; i < period; i++) {
    sum += getClose(data[i]);
  }

  result.push({ time: data[period - 1].time, value: sum / period });

  // Calculate subsequent MAs efficiently
  for (let i = period; i < data.length; i++) {
    sum -= getClose(data[i - period]);
    sum += getClose(data[i]);
    result.push({ time: data[i].time, value: sum / period });
  }

  return result;
}

/**
 * Calculates the Standard Deviation (Volatility) of closing prices over a given period.
 * @param data Candlestick data array, sorted by time ascending.
 * @param period The number of data points to include in the calculation.
 * @returns Array of LineData points representing the Volatility.
 */
export function calculateVolatility(data: CandlestickData[], period: number): LineData[] {
  if (period <= 1 || data.length < period) {
    return [];
  }

  const result: LineData[] = [];
  const closePrices = data.map(getClose);

  for (let i = period - 1; i < data.length; i++) {
    const window = closePrices.slice(i - period + 1, i + 1);

    // Calculate the mean of the window
    const mean = window.reduce((acc, val) => acc + val, 0) / period;

    // Calculate the variance
    const variance = window.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;

    // Calculate the standard deviation
    const stdDev = Math.sqrt(variance);

    result.push({ time: data[i].time, value: stdDev });
  }

  return result;
}
