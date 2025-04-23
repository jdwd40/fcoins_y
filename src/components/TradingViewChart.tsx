import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, UTCTimestamp, CandlestickData, HistogramData, ColorType } from 'lightweight-charts';
import { calculateMA, calculateVolatility } from '../services/indicatorCalculations.js'; // We'll create this helper

interface TradingViewChartProps {
  coinId: string;
  timePeriod?: string; // e.g., '1D', '7D', '1M' - adjust based on your API
  refreshTrigger: number; // To trigger refetch
}

// Define the expected API response structure
interface OHLVCData {
    time: string | number; // ISO string or UNIX timestamp (seconds or ms)
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number; // Optional volume data
}


export function TradingViewChart({ coinId, timePeriod = '7D', refreshTrigger }: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volatilitySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null); // Optional Volume Series

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    setLoading(true);
    setError(null);

    // --- Fetch Historical Data ---
    const fetchData = async () => {
      try {
        // *** IMPORTANT: Replace with your actual API endpoint - updated 23/4/2025 ***
        const response = await fetch(`/api-2/api/coins/${coinId}/price-history?period=${timePeriod}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const rawData: OHLVCData[] = await response.json();

        if (!Array.isArray(rawData) || rawData.length === 0) {
             console.warn("Received empty or invalid data for chart");
             console.log(rawData);
             setLoading(false);
             setError("No historical data available.");
             // Clear existing series if chart exists
             candlestickSeriesRef.current?.setData([]);
             maSeriesRef.current?.setData([]);
             volatilitySeriesRef.current?.setData([]);
             volumeSeriesRef.current?.setData([]);
             return;
         }


        // --- Format Data for Lightweight Charts ---
        // Timestamps need to be UNIX timestamps (seconds)
        const formattedCandlestickData: CandlestickData[] = rawData.map(d => ({
            time: (new Date(d.time).getTime() / 1000) as UTCTimestamp,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
        })).sort((a, b) => a.time - b.time); // Ensure data is sorted by time

         // Optional: Format Volume data (if available and desired)
         const formattedVolumeData: HistogramData[] = rawData
            .filter(d => d.volume !== undefined)
            .map(d => ({
                time: (new Date(d.time).getTime() / 1000) as UTCTimestamp,
                value: d.volume!,
                // Optional: Color volume bars based on price change
                color: formattedCandlestickData.find(c => c.time === (new Date(d.time).getTime() / 1000) as UTCTimestamp)
                       ? (formattedCandlestickData.find(c => c.time === (new Date(d.time).getTime() / 1000) as UTCTimestamp)!.close >= formattedCandlestickData.find(c => c.time === (new Date(d.time).getTime() / 1000) as UTCTimestamp)!.open ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255, 82, 82, 0.8)')
                       : 'rgba(128, 128, 128, 0.8)', // Default color if no match (shouldn't happen with sorted data)
            }))
            .sort((a, b) => a.time - b.time); // Ensure data is sorted


        // --- Calculate Indicators ---
        const maPeriod = 5;
        const volPeriod = 5;
        const movingAverageData = calculateMA(formattedCandlestickData, maPeriod);
        const volatilityData = calculateVolatility(formattedCandlestickData, volPeriod);


        // --- Initialize or Update Chart ---
        if (!chartRef.current) {
          // Add non-null assertion for chartContainerRef.current!
          chartRef.current = createChart(chartContainerRef.current!, {
             // Add non-null assertion for clientWidth
             width: chartContainerRef.current!.clientWidth,
             height: 400, // Initial height, adjust as needed
             layout: {
                 background: { type: ColorType.Solid, color: '#ffffff' }, // Light theme default
                 textColor: 'rgba(33, 56, 77, 1)',
             },
             grid: {
                 vertLines: { color: 'rgba(197, 203, 206, 0.5)' },
                 horzLines: { color: 'rgba(197, 203, 206, 0.5)' },
             },
             crosshair: { mode: 1 }, // CrosshairMode.Normal
             rightPriceScale: { // Main price scale
                  borderColor: 'rgba(197, 203, 206, 0.8)',
             },
             timeScale: {
                 borderColor: 'rgba(197, 203, 206, 0.8)',
                 timeVisible: true, // Show time on the bottom scale
                 secondsVisible: false, // Hide seconds if data is not granular enough
             },
             // Handle Dark Mode (Optional but recommended)
             // You might need a context or prop to detect dark mode
             // layout: { background: { type: ColorType.Solid, color: isDarkMode ? '#1f2937' : '#ffffff' }, textColor: isDarkMode ? '#d1d5db' : '#1f2937' },
             // grid: { vertLines: { color: isDarkMode ? '#4b5563' : '#e5e7eb' }, horzLines: { color: isDarkMode ? '#4b5563' : '#e5e7eb' } },
           });

          // Add Series (only once during initialization)
          candlestickSeriesRef.current = chartRef.current.addCandlestickSeries({
             upColor: 'rgba(0, 150, 136, 1)', // Green for up candles
             downColor: 'rgba(255, 82, 82, 1)', // Red for down candles
             borderDownColor: 'rgba(255, 82, 82, 1)',
             borderUpColor: 'rgba(0, 150, 136, 1)',
             wickDownColor: 'rgba(255, 82, 82, 1)',
             wickUpColor: 'rgba(0, 150, 136, 1)',
           });

          maSeriesRef.current = chartRef.current.addLineSeries({
             color: 'rgba(3, 169, 244, 1)', // Blue for MA
             lineWidth: 2,
             title: `MA(${maPeriod})`, // Add title for legend
          });

          volatilitySeriesRef.current = chartRef.current.addLineSeries({
             color: 'rgba(255, 152, 0, 1)', // Orange for Volatility
             lineWidth: 2,
             title: `Volatility(${volPeriod})`,
             // Optional: Put on a separate scale if values differ greatly
             // priceScaleId: 'volatility',
          });

           // Optional: Add Volume Series
           if (formattedVolumeData.length > 0) {
             volumeSeriesRef.current = chartRef.current.addHistogramSeries({
                 color: '#26a69a', // Default color, overridden by data point color potentially
                 priceFormat: { type: 'volume' },
                 priceScaleId: 'volume', // Use a separate price scale for volume
                 // Overlay: true, // Set to true if you want it on the main pane (might need scale adjustments)
             });
              // Configure the volume price scale
             chartRef.current.priceScale('volume').applyOptions({
                 scaleMargins: { top: 0.8, bottom: 0, }, // Adjust top margin to give space for volume bars
                 // visible: true, // Ensure scale is visible if not overlayed
             });
              if (volumeSeriesRef.current) {
                volumeSeriesRef.current.setData(formattedVolumeData);
              }
         }


        } else {
          // If chart exists, just update the data
          candlestickSeriesRef.current?.setData(formattedCandlestickData);
          maSeriesRef.current?.setData(movingAverageData);
          volatilitySeriesRef.current?.setData(volatilityData);
          if (volumeSeriesRef.current) {
             volumeSeriesRef.current.setData(formattedVolumeData);
          }
        }
         // Auto-adjust the time scale to fit the data
        chartRef.current?.timeScale().fitContent();

        setLoading(false);

      } catch (err) {
        console.error("Failed to fetch or process chart data:", err);
        setError(err instanceof Error ? err.message : 'Failed to load chart data');
        setLoading(false);
      }
    };

    fetchData();

    // --- Handle Resizing ---
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current!.clientWidth, // Add non-null assertion
          // Optional: Adjust height based on container too
          // height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // --- Cleanup ---
    return () => {
      window.removeEventListener('resize', handleResize);
      // Don't remove the chart on data refresh, only on unmount
      // chartRef.current?.remove();
      // chartRef.current = null;
    };

  // Rerun effect when coinId, timePeriod, or refreshTrigger changes
  }, [coinId, timePeriod, refreshTrigger]);

   // Cleanup chart fully on component unmount
   useEffect(() => {
       return () => {
           chartRef.current?.remove();
           chartRef.current = null;
           console.log("TradingViewChart unmounted and cleaned up.");
       };
   }, []); // Empty dependency array ensures this runs only on unmount


  return (
    <div className="relative">
      {loading && <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 dark:bg-gray-800/50 z-10">Loading Chart...</div>}
      {error && <div className="absolute inset-0 flex items-center justify-center bg-red-100/50 dark:bg-red-900/50 z-10 text-red-600 dark:text-red-300">{error}</div>}
      <div ref={chartContainerRef} style={{ height: '400px', width: '100%' }} />
      {/* Optional: Add controls for time period selection */}
      {/* <div>Controls here...</div> */}
    </div>
  );
}

// Note: The indicator calculation functions (calculateMA, calculateVolatility)
// need to be implemented, likely in a separate service file.
