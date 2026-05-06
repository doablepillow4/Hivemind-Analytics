import React, { useState } from "react";
import { useGetMarketPrices, useRunMonteCarlo } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Activity, Play } from "lucide-react";

export default function Simulator() {
  const { data: prices } = useGetMarketPrices();
  const runMonteCarlo = useRunMonteCarlo();

  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [volatility, setVolatility] = useState<number>(20);
  const [eventImpact, setEventImpact] = useState<number>(0);
  const [timeHorizon, setTimeHorizon] = useState<number>(30);
  const [simulations, setSimulations] = useState<number>(1000);

  const selectedPrice = prices?.find((p) => p.symbol === selectedSymbol);

  const handleRun = () => {
    if (!selectedSymbol || !selectedPrice) return;
    runMonteCarlo.mutate({
      data: {
        symbol: selectedSymbol,
        currentPrice: selectedPrice.price,
        volatility: volatility / 100,
        eventImpact: eventImpact / 100,
        timeHorizon,
        simulations,
      },
    });
  };

  const result = runMonteCarlo.data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Event Simulator</h1>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-primary" />
          Monte Carlo Forecasting Engine
        </p>
      </div>

      {/* Controls */}
      <Card className="bg-card/50 border-white/5">
        <CardContent className="p-4 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Target Asset</label>
            <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
              <SelectTrigger className="w-full bg-background border-white/10 h-9 text-sm">
                <SelectValue placeholder="Select Asset" />
              </SelectTrigger>
              <SelectContent>
                {prices?.map((p) => (
                  <SelectItem key={p.symbol} value={p.symbol}>
                    {p.symbol} — ${p.price.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Volatility</span>
              <span className="text-white font-mono">{volatility}%</span>
            </div>
            <Slider value={[volatility]} onValueChange={(v) => setVolatility(v[0])} max={100} min={1} step={1} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Event Impact</span>
              <span className="text-white font-mono">{eventImpact > 0 ? "+" : ""}{eventImpact}%</span>
            </div>
            <Slider value={[eventImpact]} onValueChange={(v) => setEventImpact(v[0])} max={50} min={-50} step={1} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Time Horizon</span>
              <span className="text-white font-mono">{timeHorizon} days</span>
            </div>
            <Slider value={[timeHorizon]} onValueChange={(v) => setTimeHorizon(v[0])} max={365} min={1} step={1} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Simulation Paths</label>
            <Select value={simulations.toString()} onValueChange={(v) => setSimulations(parseInt(v))}>
              <SelectTrigger className="w-full bg-background border-white/10 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="500">500 Paths</SelectItem>
                <SelectItem value="1000">1,000 Paths</SelectItem>
                <SelectItem value="2000">2,000 Paths</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleRun}
            disabled={!selectedSymbol || runMonteCarlo.isPending}
          >
            {runMonteCarlo.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Computing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Run Simulation
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Empty state */}
      {!result && !runMonteCarlo.isPending && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Select an asset and run a simulation to see the forecast.
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-card/50 border-white/5">
              <CardContent className="p-4">
                <div className="text-[10px] text-muted-foreground mb-1">Median Forecast</div>
                <div className="text-xl font-bold font-mono text-white">${result.median.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-white/5">
              <CardContent className="p-4">
                <div className="text-[10px] text-muted-foreground mb-1">Bullish / Bearish</div>
                <div className="text-base font-bold font-mono">
                  <span className="text-green-400">{(result.bullishProbability * 100).toFixed(0)}%</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-red-400">{(result.bearishProbability * 100).toFixed(0)}%</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-white/5 col-span-2">
              <CardContent className="p-4">
                <div className="text-[10px] text-muted-foreground mb-1">P10 — P90 Range</div>
                <div className="text-lg font-bold font-mono text-white">
                  ${result.p10.toFixed(0)} — ${result.p90.toFixed(0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Fan Chart */}
          <Card className="bg-card/50 border-white/5">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm text-white">Price Path Forecast</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis
                      dataKey="day"
                      stroke="#ffffff40"
                      fontSize={10}
                      tickFormatter={(v) => `D${v}`}
                      type="number"
                      domain={[0, "dataMax"]}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      stroke="#ffffff40"
                      fontSize={10}
                      tickFormatter={(v) => `$${v}`}
                      width={50}
                    />
                    {result.paths.slice(0, 40).map((path, i) => (
                      <Line
                        key={i}
                        data={path.map((val, day) => ({ day, val }))}
                        type="monotone"
                        dataKey="val"
                        stroke="#00d4ff"
                        strokeWidth={1}
                        strokeOpacity={0.15}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Percentile bar */}
          <Card className="bg-card/50 border-white/5">
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-white mb-3">Percentile Distribution</div>
              <div className="grid grid-cols-5 gap-1 text-center text-[10px] text-muted-foreground mb-2">
                <span>P10<br /><span className="text-white font-mono">${result.p10.toFixed(0)}</span></span>
                <span>P25<br /><span className="text-white font-mono">${result.p25.toFixed(0)}</span></span>
                <span className="text-primary">Med<br /><span className="font-mono">${result.median.toFixed(0)}</span></span>
                <span>P75<br /><span className="text-white font-mono">${result.p75.toFixed(0)}</span></span>
                <span>P90<br /><span className="text-white font-mono">${result.p90.toFixed(0)}</span></span>
              </div>
              <div className="w-full h-6 bg-black/40 rounded-full overflow-hidden flex relative">
                <div className="h-full bg-red-500/20" style={{ width: "10%" }} />
                <div className="h-full bg-red-500/10 border-l border-white/10" style={{ width: "15%" }} />
                <div className="h-full bg-primary/20 border-l border-white/20" style={{ width: "25%" }} />
                <div className="h-full bg-primary/20 border-l border-white/50" style={{ width: "25%" }} />
                <div className="h-full bg-green-500/10 border-l border-white/20" style={{ width: "15%" }} />
                <div className="h-full bg-green-500/20 border-l border-white/10" style={{ width: "10%" }} />
                {selectedPrice && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-10"
                    style={{
                      left: `${Math.max(2, Math.min(98, ((selectedPrice.price - result.p10) / (result.p90 - result.p10)) * 80 + 10))}%`,
                    }}
                  />
                )}
              </div>
              {selectedPrice && (
                <div className="text-[10px] text-yellow-400 text-center mt-1">▲ Current: ${selectedPrice.price.toFixed(2)}</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
