/**
 * The values of one battery (or of the `total` device) as the widgets show them, and where they come from.
 *
 * Shared by the tile of the devices app (`src-devices`) and the vis-2 widget (`src-widgets`). Both
 * subscribe to the state IDs from {@link getStateIds} and feed every update through {@link applyStateValue}.
 */

export interface BatteryValues {
    soc: number | null;
    voltage: number | null;
    current: number | null;
    power: number | null;
    remainingAh: number | null;
    totalAh: number | null;
    designAh: number | null;
    cycles: number | null;
    cellSpreadMv: number | null;
    mosTemp: number | null;
    pcbTemp: number | null;
    cellsV: number[];
    cellTemps: number[];
    reachable: boolean | null;
    lastUpdate: number | null;
    lastError: string;
    model: string;
    manufacturer: string;
    serial: string;
    /** Only for the total device: number of batteries in the aggregation */
    count: number | null;
}

export type BatteryField = keyof BatteryValues;

export type BatteryMode = 'charging' | 'discharging' | 'idle' | 'offline';

export type BatteryLevel = 'excellent' | 'good' | 'medium' | 'low' | 'critical';

/** Below this current (A) the battery counts as idle */
export const IDLE_CURRENT = 0.05;

export const COLORS = {
    voltage: '#3b6cf6',
    current: '#22b35e',
    power: '#f2a516',
    temperature: '#8b5cf6',
    good: '#4fc3a1',
    medium: '#f2a516',
    bad: '#ef4444',
    charging: '#22b35e',
    discharging: '#f2a516',
    idle: '#4fc3a1',
    offline: '#9e9e9e',
    cellMax: '#ef4444',
    cellMin: '#3b6cf6',
};

/** Default device: the aggregation over all batteries of the first instance */
export const DEFAULT_DEVICE = 'wattcycle.0.total';

export function emptyBatteryValues(): BatteryValues {
    return {
        soc: null,
        voltage: null,
        current: null,
        power: null,
        remainingAh: null,
        totalAh: null,
        designAh: null,
        cycles: null,
        cellSpreadMv: null,
        mosTemp: null,
        pcbTemp: null,
        cellsV: [],
        cellTemps: [],
        reachable: null,
        lastUpdate: null,
        lastError: '',
        model: '',
        manufacturer: '',
        serial: '',
        count: null,
    };
}

/** True if the object ID is the aggregated `total` device, e.g. `wattcycle.0.total` */
export function isTotalDevice(deviceId: string): boolean {
    return /^wattcycle\.\d+\.total$/.test(deviceId);
}

/**
 * Full state IDs of a device.
 *
 * @param deviceId full object ID of a battery device (`wattcycle.0.batteries.Watt3`) or of `wattcycle.0.total`
 */
export function getStateIds(deviceId: string): Partial<Record<BatteryField, string>> {
    if (!deviceId) {
        return {};
    }
    if (isTotalDevice(deviceId)) {
        return {
            soc: `${deviceId}.soc`,
            voltage: `${deviceId}.voltage`,
            current: `${deviceId}.current`,
            power: `${deviceId}.power`,
            remainingAh: `${deviceId}.remaining_ah`,
            totalAh: `${deviceId}.total_ah`,
            designAh: `${deviceId}.design_ah`,
            cycles: `${deviceId}.cycles_avg`,
            cellSpreadMv: `${deviceId}.cell_spread_mv_max`,
            mosTemp: `${deviceId}.mos_temp_max`,
            pcbTemp: `${deviceId}.pcb_temp_max`,
            lastUpdate: `${deviceId}.lastUpdate`,
            count: `${deviceId}.count`,
        };
    }
    return {
        soc: `${deviceId}.soc`,
        voltage: `${deviceId}.voltage`,
        current: `${deviceId}.current`,
        power: `${deviceId}.power`,
        remainingAh: `${deviceId}.remaining_ah`,
        totalAh: `${deviceId}.total_ah`,
        designAh: `${deviceId}.design_ah`,
        cycles: `${deviceId}.cycles`,
        cellSpreadMv: `${deviceId}.cell_spread_mv`,
        mosTemp: `${deviceId}.mos_temp`,
        pcbTemp: `${deviceId}.pcb_temp`,
        cellsV: `${deviceId}.cells_v`,
        cellTemps: `${deviceId}.cell_temps`,
        reachable: `${deviceId}.reachable`,
        lastUpdate: `${deviceId}.lastUpdate`,
        lastError: `${deviceId}.lastError`,
        model: `${deviceId}.product.model_or_fw`,
        manufacturer: `${deviceId}.product.manufacturer`,
        serial: `${deviceId}.product.serial`,
    };
}

function toNumber(val: unknown): number | null {
    if (val === null || val === undefined || val === '') {
        return null;
    }
    const n = typeof val === 'number' ? val : parseFloat(String(val));
    return Number.isFinite(n) ? n : null;
}

function toNumberList(val: unknown): number[] {
    if (Array.isArray(val)) {
        return val.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    }
    if (typeof val !== 'string' || !val) {
        return [];
    }
    try {
        return toNumberList(JSON.parse(val));
    } catch {
        return [];
    }
}

/**
 * Store a new state value in a copy of the values.
 *
 * @param values current values
 * @param field which value the state belongs to
 * @param val the state's value
 */
export function applyStateValue(values: BatteryValues, field: BatteryField, val: unknown): BatteryValues {
    const next = { ...values };
    switch (field) {
        case 'cellsV':
        case 'cellTemps':
            next[field] = toNumberList(val);
            break;
        case 'reachable':
            next.reachable = val === null || val === undefined ? null : val === true || val === 'true' || val === 1;
            break;
        case 'lastError':
        case 'model':
        case 'manufacturer':
        case 'serial':
            next[field] = val === null || val === undefined ? '' : String(val);
            break;
        default:
            next[field] = toNumber(val);
    }
    return next;
}

export function getMode(values: BatteryValues): BatteryMode {
    if (values.reachable === false || values.count === 0 || values.soc === null) {
        return 'offline';
    }
    const current = values.current ?? 0;
    if (current >= IDLE_CURRENT) {
        return 'charging';
    }
    if (current <= -IDLE_CURRENT) {
        return 'discharging';
    }
    return 'idle';
}

export function getLevel(soc: number | null): BatteryLevel | null {
    if (soc === null) {
        return null;
    }
    if (soc >= 80) {
        return 'excellent';
    }
    if (soc >= 50) {
        return 'good';
    }
    if (soc >= 30) {
        return 'medium';
    }
    if (soc >= 15) {
        return 'low';
    }
    return 'critical';
}

export function getSocColor(soc: number | null): string {
    if (soc === null) {
        return COLORS.offline;
    }
    if (soc >= 50) {
        return COLORS.good;
    }
    if (soc >= 20) {
        return COLORS.medium;
    }
    return COLORS.bad;
}

/** State of health in %: full capacity relative to the design capacity */
export function getSoh(values: BatteryValues): number | null {
    if (!values.totalAh || !values.designAh) {
        return null;
    }
    return Math.min(100, (values.totalAh / values.designAh) * 100);
}

/** The temperature for the overview: the warmest cell, else the board */
export function getTemperature(values: BatteryValues): number | null {
    if (values.cellTemps.length) {
        return Math.max(...values.cellTemps);
    }
    return values.pcbTemp ?? values.mosTemp;
}

/**
 * @param value number to show, or null for a dash
 * @param decimals fixed number of decimals
 * @param isFloatComma use a comma as the decimal separator
 */
export function formatNumber(value: number | null | undefined, decimals: number, isFloatComma?: boolean): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return '—';
    }
    const text = value.toFixed(decimals);
    return isFloatComma ? text.replace('.', ',') : text;
}

/** Translation keys used by the views. Hosts look them up with the `wattcycle_` prefix */
export type ViewWord =
    | 'SOC'
    | 'Charging'
    | 'Discharging'
    | 'Idle'
    | 'Offline'
    | 'Battery'
    | 'level_excellent'
    | 'level_good'
    | 'level_medium'
    | 'level_low'
    | 'level_critical'
    | 'Voltage'
    | 'Current'
    | 'Power'
    | 'Temperature'
    | 'Battery health'
    | 'SOH'
    | 'Rated capacity'
    | 'Full capacity'
    | 'Remaining'
    | 'Cycles'
    | 'Cells'
    | 'Cell spread'
    | 'Temperatures'
    | 'MOSFET'
    | 'PCB'
    | 'Model'
    | 'Serial'
    | 'Last update'
    | 'Batteries'
    | 'Error';

export type Translate = (word: ViewWord) => string;
