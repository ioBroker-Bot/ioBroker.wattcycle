/**
 * Views of a WattCycle battery, modelled after the WattCycle app: a SOC arc, the charge state as a pill,
 * round coloured symbols for voltage, current, power and temperature, battery health and the cells.
 *
 * Used by both the devices tile and the vis-2 widget. Everything here is a plain function of its props:
 * no hooks, no context, no MUI. The devices app hands its plugins React through a global and the plugin's
 * own JSX runtime may come from another copy; components without hooks render with either of them.
 * Colours that depend on the theme are taken from `currentColor` and transparency, so the views fit a
 * light and a dark theme alike.
 */
import type React from 'react';
import {
    COLORS,
    formatNumber,
    getLevel,
    getMode,
    getSocColor,
    getSoh,
    getTemperature,
    type BatteryMode,
    type BatteryValues,
    type Translate,
} from './batteryData';

export interface BatteryViewProps {
    values: BatteryValues;
    t: Translate;
    isFloatComma?: boolean;
    /** Name of the battery, shown where the layout has room for it */
    name?: string;
}

/** Background of the inner cards: a tint of the text colour, so it works on light and dark themes */
const CARD_BG = 'rgba(128, 128, 128, 0.10)';
const TRACK = 'rgba(128, 128, 128, 0.25)';

const ICON_PATHS = {
    bolt: 'M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66s.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21',
    down: 'm19 15-1.41-1.41L13 18.17V2h-2v16.17l-4.59-4.59L5 15l7 7z',
    pause: 'M9 16h2V8H9zm3-14C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m1-4h2V8h-2z',
    offline:
        'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20m6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9',
    thermometer:
        'M15 13V5c0-1.66-1.34-3-3-3S9 3.34 9 5v8c-1.21.91-2 2.37-2 4 0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.63-.79-3.09-2-4m-4-8c0-.55.45-1 1-1s1 .45 1 1h-1v1h1v2h-1v1h1v2h-2z',
    health: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-8 14H7v-2h4zm6-4H7v-2h10zm0-4H7V7h10z',
    cells: 'M4 8h4V4H4zm6 12h4v-4h-4zm-6 0h4v-4H4zm0-6h4v-4H4zm6 0h4v-4h-4zm6-10v4h4V4zm-6 4h4V4h-4zm6 6h4v-4h-4zm0 6h4v-4h-4z',
    info: 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8',
};

function SvgIcon(props: { path: string; size: number | string; color?: string }): React.JSX.Element {
    return (
        <svg
            viewBox="0 0 24 24"
            style={{ width: props.size, height: props.size, flexShrink: 0, display: 'block' }}
        >
            <path
                fill={props.color || 'currentColor'}
                d={props.path}
            />
        </svg>
    );
}

const MODE_COLORS: Record<BatteryMode, string> = {
    charging: COLORS.charging,
    discharging: COLORS.discharging,
    idle: COLORS.idle,
    offline: COLORS.offline,
};

const MODE_ICONS: Record<BatteryMode, string> = {
    charging: ICON_PATHS.bolt,
    discharging: ICON_PATHS.down,
    idle: ICON_PATHS.pause,
    offline: ICON_PATHS.offline,
};

const MODE_WORDS = {
    charging: 'Charging',
    discharging: 'Discharging',
    idle: 'Idle',
    offline: 'Offline',
} as const;

// -------------------------------------------------------------------------------------------------
// Building blocks

function polar(angle: number, r: number): [number, number] {
    const rad = (angle * Math.PI) / 180;
    return [50 + r * Math.cos(rad), 50 + r * Math.sin(rad)];
}

function arcPath(from: number, to: number, r: number): string {
    const [x1, y1] = polar(from, r);
    const [x2, y2] = polar(to, r);
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

const GAUGE_START = 135;
const GAUGE_SWEEP = 270;

/**
 * The SOC arc of the app: a 270° ring with tick marks, the percentage and "SOC" in the middle.
 * It scales with its container: give it a width (and/or height) through `style`.
 */
export function SocGauge(props: {
    soc: number | null;
    mode: BatteryMode;
    t: Translate;
    style?: React.CSSProperties;
}): React.JSX.Element {
    const { soc, mode } = props;
    const color = getSocColor(soc);
    const r = 40;
    const value = soc === null ? 0 : Math.max(0, Math.min(100, soc));
    const end = GAUGE_START + (GAUGE_SWEEP * value) / 100;
    const ticks: React.JSX.Element[] = [];
    for (let i = 0; i <= 5; i++) {
        const angle = GAUGE_START + (GAUGE_SWEEP * i) / 5;
        const [x1, y1] = polar(angle, r - 6.5);
        const [x2, y2] = polar(angle, r + 6.5);
        ticks.push(
            <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255, 255, 255, 0.85)"
                strokeWidth={1.4}
                strokeLinecap="round"
            />,
        );
    }

    return (
        <svg
            viewBox="0 0 100 100"
            style={{ display: 'block', overflow: 'visible', ...props.style }}
        >
            <path
                d={arcPath(GAUGE_START, GAUGE_START + GAUGE_SWEEP, r)}
                fill="none"
                stroke={TRACK}
                strokeWidth={13}
                strokeLinecap="round"
            />
            {value > 0 ? (
                <path
                    d={arcPath(GAUGE_START, Math.max(end, GAUGE_START + 0.5), r)}
                    fill="none"
                    stroke={color}
                    strokeWidth={13}
                    strokeLinecap="round"
                >
                    {mode === 'charging' ? (
                        <animate
                            attributeName="opacity"
                            values="1;0.55;1"
                            dur="2s"
                            repeatCount="indefinite"
                        />
                    ) : null}
                </path>
            ) : null}
            {ticks}
            {mode === 'charging' || mode === 'discharging' ? (
                <g transform="translate(43.5 22) scale(0.55)">
                    <path
                        fill={MODE_COLORS[mode]}
                        d={MODE_ICONS[mode]}
                    />
                </g>
            ) : null}
            <text
                x={50}
                y={56}
                textAnchor="middle"
                fontSize={soc !== null && soc >= 100 ? 17 : 19}
                fontWeight={700}
                fill={soc === null ? 'currentColor' : color}
                style={{ fontFamily: 'inherit' }}
            >
                {soc === null ? '—' : `${Math.round(soc)}%`}
            </text>
            <text
                x={50}
                y={69}
                textAnchor="middle"
                fontSize={7.5}
                fill="currentColor"
                opacity={0.65}
                style={{ fontFamily: 'inherit' }}
            >
                {props.t('SOC')}
            </text>
        </svg>
    );
}

/** The charge state as a pill: "Idle", "Charging", "Discharging" or "Offline" */
export function ModeBadge(props: {
    mode: BatteryMode;
    t: Translate;
    fontSize?: number | string;
    style?: React.CSSProperties;
}): React.JSX.Element {
    const color = MODE_COLORS[props.mode];
    return (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5em',
                padding: '0.35em 0.9em 0.35em 0.6em',
                borderRadius: 999,
                background: `${color}26`,
                color,
                fontSize: props.fontSize ?? 14,
                fontWeight: 600,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                ...props.style,
            }}
        >
            <SvgIcon
                path={MODE_ICONS[props.mode]}
                size="1.3em"
            />
            {props.t(MODE_WORDS[props.mode])}
        </div>
    );
}

/** A coloured circle with a letter or an icon, like V / A / W in the app */
function Symbol(props: { color: string; letter?: string; icon?: string; size: number | string }): React.JSX.Element {
    return (
        <div
            style={{
                width: props.size,
                height: props.size,
                borderRadius: '50%',
                background: props.color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontWeight: 700,
                fontSize: `calc(${typeof props.size === 'number' ? `${props.size}px` : props.size} * 0.45)`,
            }}
        >
            {props.icon ? (
                <SvgIcon
                    path={props.icon}
                    size="58%"
                    color="#fff"
                />
            ) : (
                props.letter
            )}
        </div>
    );
}

interface Metric {
    key: string;
    color: string;
    letter?: string;
    icon?: string;
    value: string;
    unit: string;
    label: string;
}

function getMetrics(props: BatteryViewProps): Metric[] {
    const { values, t, isFloatComma } = props;
    return [
        {
            key: 'voltage',
            color: COLORS.voltage,
            letter: 'V',
            value: formatNumber(values.voltage, 2, isFloatComma),
            unit: 'V',
            label: t('Voltage'),
        },
        {
            key: 'current',
            color: COLORS.current,
            letter: 'A',
            value: formatNumber(values.current, 2, isFloatComma),
            unit: 'A',
            label: t('Current'),
        },
        {
            key: 'power',
            color: COLORS.power,
            letter: 'W',
            value: formatNumber(
                values.power,
                values.power !== null && Math.abs(values.power) >= 100 ? 0 : 1,
                isFloatComma,
            ),
            unit: 'W',
            label: t('Power'),
        },
        {
            key: 'temperature',
            color: COLORS.temperature,
            icon: ICON_PATHS.thermometer,
            value: formatNumber(getTemperature(values), 1, isFloatComma),
            unit: '°C',
            label: t('Temperature'),
        },
    ];
}

function MetricItem(props: {
    metric: Metric;
    symbolSize: number | string;
    fontSize: number | string;
}): React.JSX.Element {
    const { metric } = props;
    const hasValue = metric.value !== '—';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7em', minWidth: 0, fontSize: props.fontSize }}>
            <Symbol
                color={metric.color}
                letter={metric.letter}
                icon={metric.icon}
                size={props.symbolSize}
            />
            <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '1.25em', lineHeight: 1.15, whiteSpace: 'nowrap' }}>
                    {metric.value}
                    {hasValue ? metric.unit : ''}
                </div>
                <div
                    style={{
                        opacity: 0.65,
                        fontSize: '0.85em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {metric.label}
                </div>
            </div>
        </div>
    );
}

function Card(props: { children: React.ReactNode; style?: React.CSSProperties }): React.JSX.Element {
    return (
        <div
            style={{
                background: CARD_BG,
                borderRadius: 16,
                padding: 16,
                boxSizing: 'border-box',
                minWidth: 0,
                ...props.style,
            }}
        >
            {props.children}
        </div>
    );
}

function CardTitle(props: { icon: string; color: string; children: React.ReactNode }): React.JSX.Element {
    return (
        <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 700, marginBottom: 14 }}
        >
            <SvgIcon
                path={props.icon}
                size={24}
                color={props.color}
            />
            <span style={{ flex: 1 }}>{props.children}</span>
        </div>
    );
}

function Figure(props: { value: string; label: string }): React.JSX.Element {
    return (
        <div style={{ textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{props.value}</div>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>{props.label}</div>
        </div>
    );
}

/** Cell voltages as small bars, the highest cell red and the lowest blue */
export function CellGrid(props: BatteryViewProps): React.JSX.Element | null {
    const { values, isFloatComma } = props;
    const cells = values.cellsV;
    if (!cells.length) {
        return null;
    }
    const min = Math.min(...cells);
    const max = Math.max(...cells);
    // LiFePO4 window: 2.5 V empty, 3.65 V full
    const fill = (v: number): number => Math.max(0.04, Math.min(1, (v - 2.5) / (3.65 - 2.5)));
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))',
                gap: 8,
            }}
        >
            {cells.map((v, i) => {
                const marker =
                    cells.length > 1 && max > min
                        ? v === max
                            ? COLORS.cellMax
                            : v === min
                              ? COLORS.cellMin
                              : null
                        : null;
                const temp = values.cellTemps.length === cells.length ? values.cellTemps[i] : undefined;
                return (
                    <div
                        key={i}
                        style={{
                            borderRadius: 10,
                            padding: '8px 10px',
                            background: CARD_BG,
                            border: `1px solid ${marker || 'transparent'}`,
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.65 }}>
                            <span>#{i + 1}</span>
                            {temp !== undefined ? <span>{formatNumber(temp, 1, isFloatComma)}°C</span> : null}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: marker || undefined, margin: '2px 0 6px' }}>
                            {formatNumber(v, 3, isFloatComma)} V
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: TRACK, overflow: 'hidden' }}>
                            <div
                                style={{
                                    width: `${fill(v) * 100}%`,
                                    height: '100%',
                                    borderRadius: 3,
                                    background: marker || COLORS.good,
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// -------------------------------------------------------------------------------------------------
// Layouts

/**
 * Size container for the tile layouts: their children are sized in `cqi`, i.e. relative to the width
 * of this element. The `cqi` of an element's own style refers to the next container above it, so the
 * layout itself is the inner element and only its children - never it - may use these units.
 */
function SizeContainer(props: { style: React.CSSProperties; children: React.ReactNode }): React.JSX.Element {
    return (
        <div style={{ width: '100%', height: '100%', containerType: 'inline-size' }}>
            <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', ...props.style }}>
                {props.children}
            </div>
        </div>
    );
}

/** Everything at once, for a dialog or a large vis-2 widget */
export function BatteryFullView(props: BatteryViewProps): React.JSX.Element {
    const { values, t, isFloatComma } = props;
    const mode = getMode(values);
    const level = getLevel(values.soc);
    const metrics = getMetrics(props);
    const soh = getSoh(values);
    const isTotal = values.count !== null;

    const temps: { label: string; value: number | null }[] = [
        { label: t('MOSFET'), value: values.mosTemp },
        { label: t('PCB'), value: values.pcbTemp },
    ];
    if (values.cellTemps.length && values.cellTemps.length !== values.cellsV.length) {
        values.cellTemps.forEach((v, i) => temps.push({ label: `T${i + 1}`, value: v }));
    }

    const info: { label: string; value: string }[] = [];
    if (values.model) {
        info.push({ label: t('Model'), value: values.model });
    }
    if (values.serial) {
        info.push({ label: t('Serial'), value: values.serial });
    }
    if (isTotal) {
        info.push({ label: t('Batteries'), value: String(values.count) });
    }
    if (values.lastUpdate) {
        info.push({ label: t('Last update'), value: new Date(values.lastUpdate).toLocaleString() });
    }

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
                gap: 12,
                alignItems: 'start',
                width: '100%',
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                <Card style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <SocGauge
                        soc={values.soc}
                        mode={mode}
                        t={t}
                        style={{ width: 130, height: 130, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <ModeBadge
                            mode={mode}
                            t={t}
                            style={{ alignSelf: 'stretch' }}
                        />
                        <div>
                            <div style={{ opacity: 0.65, fontSize: 14 }}>{props.name || t('Battery')}</div>
                            {level ? (
                                <div style={{ color: getSocColor(values.soc), fontWeight: 600, fontSize: 15 }}>
                                    {t(`level_${level}`)}
                                </div>
                            ) : null}
                        </div>
                        {values.remainingAh !== null ? (
                            <div style={{ fontSize: 13, opacity: 0.8 }}>
                                {t('Remaining')}: <b>{formatNumber(values.remainingAh, 1, isFloatComma)} Ah</b>
                                {values.totalAh ? ` / ${formatNumber(values.totalAh, 1, isFloatComma)} Ah` : ''}
                            </div>
                        ) : null}
                    </div>
                </Card>
                <Card style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 18, columnGap: 12 }}>
                    {metrics.map(m => (
                        <MetricItem
                            key={m.key}
                            metric={m}
                            symbolSize={42}
                            fontSize={15}
                        />
                    ))}
                </Card>
                <Card>
                    <CardTitle
                        icon={ICON_PATHS.health}
                        color={COLORS.good}
                    >
                        {t('Battery health')}
                    </CardTitle>
                    <div
                        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: 12 }}
                    >
                        <Figure
                            value={soh === null ? '—' : `${formatNumber(soh, 0, isFloatComma)}%`}
                            label={t('SOH')}
                        />
                        <Figure
                            value={values.designAh ? `${formatNumber(values.designAh, 0, isFloatComma)}Ah` : '—'}
                            label={t('Rated capacity')}
                        />
                        <Figure
                            value={values.totalAh ? `${formatNumber(values.totalAh, 1, isFloatComma)}Ah` : '—'}
                            label={t('Full capacity')}
                        />
                        <Figure
                            value={formatNumber(values.cycles, isTotal ? 1 : 0, isFloatComma)}
                            label={t('Cycles')}
                        />
                    </div>
                </Card>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                {values.cellsV.length || values.cellSpreadMv !== null ? (
                    <Card>
                        <CardTitle
                            icon={ICON_PATHS.cells}
                            color={COLORS.voltage}
                        >
                            {t('Cells')}
                            {values.cellSpreadMv !== null ? (
                                <span style={{ float: 'right', fontSize: 13, fontWeight: 500, opacity: 0.75 }}>
                                    {t('Cell spread')}: {formatNumber(values.cellSpreadMv, 0, isFloatComma)} mV
                                </span>
                            ) : null}
                        </CardTitle>
                        <CellGrid {...props} />
                    </Card>
                ) : null}
                <Card>
                    <CardTitle
                        icon={ICON_PATHS.thermometer}
                        color={COLORS.temperature}
                    >
                        {t('Temperatures')}
                    </CardTitle>
                    <div
                        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: 12 }}
                    >
                        {temps.map(item => (
                            <Figure
                                key={item.label}
                                value={item.value === null ? '—' : `${formatNumber(item.value, 1, isFloatComma)}°C`}
                                label={item.label}
                            />
                        ))}
                    </div>
                </Card>
                {info.length || values.lastError ? (
                    <Card style={{ fontSize: 13 }}>
                        {info.map(item => (
                            <div
                                key={item.label}
                                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0' }}
                            >
                                <span style={{ opacity: 0.65 }}>{item.label}</span>
                                <span style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{item.value}</span>
                            </div>
                        ))}
                        {values.lastError ? (
                            <div style={{ color: COLORS.bad, marginTop: info.length ? 8 : 0 }}>
                                {t('Error')}: {values.lastError}
                            </div>
                        ) : null}
                    </Card>
                ) : null}
            </div>
        </div>
    );
}

/** A square tile: the SOC arc with the charge state below */
export function BatteryCompactView(props: BatteryViewProps & { hideName?: boolean }): React.JSX.Element {
    const { values, t } = props;
    const mode = getMode(values);
    return (
        <SizeContainer
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <SocGauge
                soc={values.soc}
                mode={mode}
                t={t}
                style={{ width: '62cqi', height: '62cqi', maxWidth: '100%' }}
            />
            <ModeBadge
                mode={mode}
                t={t}
                fontSize="max(10px, 6cqi)"
                style={{ marginTop: '2cqi' }}
            />
            {props.name && !props.hideName ? (
                <div
                    style={{
                        marginTop: '2cqi',
                        fontWeight: 600,
                        fontSize: 'max(11px, 7cqi)',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {props.name}
                </div>
            ) : null}
        </SizeContainer>
    );
}

/** A thin horizontal bar: a battery symbol filled to the SOC, then voltage, current and power */
export function BatteryBarView(props: BatteryViewProps): React.JSX.Element {
    const { values, t } = props;
    const mode = getMode(values);
    const color = getSocColor(values.soc);
    const soc = values.soc === null ? 0 : Math.max(0, Math.min(100, values.soc));
    const metrics = getMetrics(props).slice(0, 3);
    return (
        <SizeContainer
            style={{
                display: 'flex',
                alignItems: 'center',
            }}
        >
            <div style={{ position: 'relative', width: '22cqi', height: '10cqi', flexShrink: 0, marginRight: '3cqi' }}>
                <div
                    style={{
                        position: 'absolute',
                        inset: '0 1.2cqi 0 0',
                        border: `0.6cqi solid ${TRACK}`,
                        borderRadius: '2cqi',
                        overflow: 'hidden',
                    }}
                >
                    <div style={{ width: `${soc}%`, height: '100%', background: `${color}cc` }} />
                </div>
                <div
                    style={{
                        position: 'absolute',
                        right: 0,
                        top: '30%',
                        width: '1.2cqi',
                        height: '40%',
                        borderRadius: '0 0.6cqi 0.6cqi 0',
                        background: TRACK,
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        inset: '0 1.2cqi 0 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5cqi',
                        fontWeight: 700,
                        fontSize: '4.2cqi',
                    }}
                >
                    {mode === 'charging' || mode === 'discharging' ? (
                        <SvgIcon
                            path={MODE_ICONS[mode]}
                            size="4.5cqi"
                            color={MODE_COLORS[mode]}
                        />
                    ) : null}
                    {values.soc === null ? '—' : `${Math.round(values.soc)}%`}
                </div>
            </div>
            {props.name ? (
                <div
                    style={{
                        fontWeight: 600,
                        fontSize: 'max(11px, 4cqi)',
                        opacity: 0.8,
                        minWidth: 0,
                        flex: '0 1 auto',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                    }}
                    title={t(MODE_WORDS[mode])}
                >
                    {props.name}
                </div>
            ) : null}
            <div style={{ flex: 1 }} />
            {metrics.map(m => (
                <div
                    key={m.key}
                    style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '0.25em',
                        whiteSpace: 'nowrap',
                        marginLeft: '3cqi',
                        fontSize: 'max(11px, 4.2cqi)',
                    }}
                    title={m.label}
                >
                    <span style={{ fontWeight: 700, fontSize: '1.2em', color: m.value === '—' ? undefined : m.color }}>
                        {m.value}
                    </span>
                    <span style={{ opacity: 0.65 }}>{m.unit}</span>
                </div>
            ))}
        </SizeContainer>
    );
}

/** A wide tile: the SOC arc on the left, charge state and the four values on the right */
export function BatteryWideView(props: BatteryViewProps): React.JSX.Element {
    const { values, t } = props;
    const mode = getMode(values);
    const metrics = getMetrics(props);
    return (
        <SizeContainer
            style={{
                display: 'flex',
                alignItems: 'center',
            }}
        >
            <SocGauge
                soc={values.soc}
                mode={mode}
                t={t}
                style={{ width: '36cqi', height: '36cqi', flexShrink: 0, marginRight: '4cqi' }}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2.4cqi' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2cqi', minWidth: 0 }}>
                    <ModeBadge
                        mode={mode}
                        t={t}
                        fontSize="max(10px, 3.6cqi)"
                    />
                    {props.name ? (
                        <div
                            style={{
                                fontWeight: 600,
                                fontSize: 'max(11px, 4cqi)',
                                minWidth: 0,
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {props.name}
                        </div>
                    ) : null}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: '2.4cqi', columnGap: '2cqi' }}>
                    {metrics.map(m => (
                        <MetricItem
                            key={m.key}
                            metric={m}
                            symbolSize="max(20px, 7.5cqi)"
                            fontSize="max(10px, 3.5cqi)"
                        />
                    ))}
                </div>
            </div>
        </SizeContainer>
    );
}
