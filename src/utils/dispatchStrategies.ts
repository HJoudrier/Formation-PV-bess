import { HourlyDataPoint, MicrogridParameters } from '../types';

export function applyDispatchStrategy(
  hourlyData: HourlyDataPoint[],
  params: MicrogridParameters,
  strategy: 'self_consumption' | 'peak_shaving' | 'spot_arbitrage' | 'zero_injection' | 'reset'
): HourlyDataPoint[] {
  const pBattMax = params.batteryPowerKw;

  return hourlyData.map((pt) => {
    const pvGen = pt.pvNormKwPerKwc * params.pvInstalledKwc;
    const netBalance = pvGen - pt.loadKw; // >0 is solar surplus, <0 is load deficit
    let cmd = 0;

    switch (strategy) {
      case 'reset':
        cmd = 0;
        break;

      case 'self_consumption':
        // Charge on surplus, discharge on deficit
        if (netBalance > 0) {
          cmd = Math.min(pBattMax, netBalance);
        } else if (netBalance < 0) {
          cmd = -Math.min(pBattMax, Math.abs(netBalance));
        }
        break;

      case 'peak_shaving': {
        // Shave peaks that approach grid limit
        const peakThreshold = params.gridMaxPowerKw * 0.75;
        const requiredFromGrid = pt.loadKw - pvGen;
        if (requiredFromGrid > peakThreshold) {
          const toShave = requiredFromGrid - peakThreshold;
          cmd = -Math.min(pBattMax, toShave);
        } else if (netBalance > 0) {
          // recharge from surplus
          cmd = Math.min(pBattMax, netBalance);
        } else if (pt.hour >= 1 && pt.hour <= 5 && requiredFromGrid < peakThreshold * 0.5) {
          // trickle charge at night
          cmd = Math.min(pBattMax * 0.5, peakThreshold - requiredFromGrid);
        }
        break;
      }

      case 'spot_arbitrage': {
        // Identify cheap hours vs expensive hours
        // Under standard profiles: hours 0-5 and 12-14 are cheap; 7-10 and 18-21 are expensive
        const price = pt.spotPriceEurPerMwh;
        if (price <= 60 || netBalance > 10) {
          // Charge
          cmd = Math.min(pBattMax, Math.max(netBalance, pBattMax * 0.8));
        } else if (price >= 115 || (price >= 90 && netBalance < -10)) {
          // Discharge
          cmd = -Math.min(pBattMax, Math.abs(netBalance > 0 ? 0 : netBalance) + 15);
        }
        break;
      }

      case 'zero_injection':
        // Only charge when solar is greater than load, never inject
        if (netBalance > 0) {
          cmd = Math.min(pBattMax, netBalance);
        }
        break;
    }

    // Round to 1 decimal place for clean numbers
    cmd = Math.round(cmd * 10) / 10;

    return {
      ...pt,
      batteryDispatchCmdKw: cmd
    };
  });
}
