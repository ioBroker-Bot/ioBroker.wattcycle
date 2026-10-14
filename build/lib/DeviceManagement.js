"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WattCycleDeviceManagement = void 0;
const dm_utils_1 = require("@iobroker/dm-utils");
const i18n_1 = require("./i18n");
/** ID of the card that shows the aggregated values */
const TOTAL_ID = 'total';
/** Below this current (A) the battery counts as idle */
const IDLE_CURRENT = 0.05;
function svgIcon(path) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="${path}"/></svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
const ICON_BATTERY = svgIcon('M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4');
const ICON_TOTAL = svgIcon('M18 4H6v2l6.5 6L6 18v2h12v-3h-7l5-5-5-5h7z');
const ICON_DISCHARGE = svgIcon('m19 15-1.41-1.41L13 18.17V2h-2v16.17l-4.59-4.59L5 15l7 7z');
const ICON_IDLE = svgIcon('M9 16h2V8H9zm3-14C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m1-4h2V8h-2z');
const ICON_VOLTAGE = svgIcon('M5 4h2.5L12 16.5 16.5 4H19l-5.8 16h-2.4z');
const ICON_POWER = svgIcon('M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66s.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21');
const ICON_TEMPERATURE = svgIcon('M15 13V5c0-1.66-1.34-3-3-3S9 3.34 9 5v8c-1.21.91-2 2.37-2 4 0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.63-.79-3.09-2-4m-4-8c0-.55.45-1 1-1s1 .45 1 1h-1v1h1v2h-1v1h1v2h-2z');
function batteryStates(devId) {
    return {
        soc: `${devId}.soc`,
        voltage: `${devId}.voltage`,
        current: `${devId}.current`,
        power: `${devId}.power`,
        remainingAh: `${devId}.remaining_ah`,
        totalAh: `${devId}.total_ah`,
        designAh: `${devId}.design_ah`,
        cycles: `${devId}.cycles`,
        cellSpread: `${devId}.cell_spread_mv`,
        mosTemp: `${devId}.mos_temp`,
        pcbTemp: `${devId}.pcb_temp`,
    };
}
const TOTAL_STATES = {
    soc: 'total.soc',
    voltage: 'total.voltage',
    current: 'total.current',
    power: 'total.power',
    remainingAh: 'total.remaining_ah',
    totalAh: 'total.total_ah',
    designAh: 'total.design_ah',
    cycles: 'total.cycles_avg',
    cellSpread: 'total.cell_spread_mv_max',
    mosTemp: 'total.mos_temp_max',
    pcbTemp: 'total.pcb_temp_max',
};
class WattCycleDeviceManagement extends dm_utils_1.DeviceManagement {
    full(relId) {
        return `${this.adapter.namespace}.${relId}`;
    }
    getBatteries() {
        const list = this.adapter.config.batteries;
        return Array.isArray(list) ? list.filter(b => b?.mac) : [];
    }
    findBattery(mac) {
        return this.getBatteries().find(b => b.mac === mac);
    }
    getInstanceInfo() {
        return {
            apiVersion: 'v3',
            identifierLabel: 'MAC',
            actions: [
                {
                    id: 'scan',
                    icon: 'search',
                    title: (0, i18n_1.t)('Scan for batteries'),
                    description: (0, i18n_1.t)('Scan for batteries'),
                    handler: (context) => this.onScan(context),
                },
                {
                    id: 'pollAll',
                    icon: 'refresh',
                    description: (0, i18n_1.t)('Poll now'),
                    handler: async (context) => {
                        await this.poll(context);
                        return { refresh: false };
                    },
                },
            ],
        };
    }
    loadDevices(context) {
        const batteries = this.getBatteries();
        context.setTotalDevices(batteries.length + (batteries.length ? 1 : 0));
        for (const bat of batteries) {
            context.addDevice(this.getBatteryInfo(bat));
        }
        if (batteries.length) {
            context.addDevice(this.getTotalInfo());
        }
    }
    getDeviceDetails(id) {
        if (id === TOTAL_ID) {
            return this.getTotalDetails();
        }
        const bat = this.findBattery(id);
        if (!bat) {
            return Promise.resolve({ error: `Unknown battery ${id}` });
        }
        return this.getBatteryDetails(bat);
    }
    // ---------------------------------------------------------------------------------------------
    // Cards
    getIndicators(ids) {
        return [
            {
                id: 'mode',
                value: { stateId: this.full(ids.current) },
                showValue: true,
                unit: 'A',
                label: (0, i18n_1.t)('Current'),
                configurable: true,
                order: 10,
                levels: [
                    { min: IDLE_CURRENT, icon: 'batteryCharging', color: 'ok', tooltip: (0, i18n_1.t)('Charging') },
                    { max: -IDLE_CURRENT, icon: ICON_DISCHARGE, color: 'warning', tooltip: (0, i18n_1.t)('Discharging') },
                    { icon: ICON_IDLE, color: 'inactive', tooltip: (0, i18n_1.t)('Idle') },
                ],
            },
            {
                id: 'voltage',
                value: { stateId: this.full(ids.voltage) },
                icon: ICON_VOLTAGE,
                color: 'info',
                showValue: true,
                unit: 'V',
                tooltip: (0, i18n_1.t)('Voltage'),
                configurable: true,
                order: 20,
            },
            {
                id: 'power',
                value: { stateId: this.full(ids.power) },
                icon: ICON_POWER,
                color: 'warning',
                showValue: true,
                unit: 'W',
                tooltip: (0, i18n_1.t)('Power'),
                configurable: true,
                order: 30,
            },
            {
                id: 'temperature',
                value: { stateId: this.full(ids.mosTemp) },
                icon: ICON_TEMPERATURE,
                showValue: true,
                unit: '°C',
                tooltip: (0, i18n_1.t)('MOSFET temperature'),
                configurable: true,
                order: 40,
                levels: [{ min: 60, color: 'error' }, { min: 45, color: 'warning' }, { color: 'ok' }],
            },
        ];
    }
    getCustomInfo(id, ids) {
        return {
            id,
            schema: {
                type: 'panel',
                items: {
                    remaining: this.stateItem(ids.remainingAh, (0, i18n_1.t)('Remaining capacity'), 'Ah'),
                    cycles: this.stateItem(ids.cycles, (0, i18n_1.t)('Cycles')),
                    spread: this.stateItem(ids.cellSpread, (0, i18n_1.t)('Cell spread'), 'mV'),
                },
            },
        };
    }
    getBatteryInfo(bat) {
        const enabled = bat.enabled !== false;
        const devId = this.adapter.getDeviceId(bat);
        const ids = batteryStates(devId);
        const actions = [
            {
                id: dm_utils_1.ACTIONS.ENABLE_DISABLE,
                description: (0, i18n_1.t)('Enabled'),
                handler: async (mac, context) => {
                    await this.adapter.updateBatteries(list => list.map(b => (b.mac === mac ? { ...b, enabled: b.enabled === false } : b)));
                    await context.showMessage((0, i18n_1.t)('Settings changed'));
                    return { refresh: 'devices' };
                },
            },
            {
                id: 'edit',
                icon: 'edit',
                description: (0, i18n_1.t)('Edit'),
                handler: (mac, context) => this.onEdit(mac, context),
            },
            {
                id: 'delete',
                icon: 'delete',
                description: (0, i18n_1.t)('Delete'),
                confirmation: (0, i18n_1.t)('Delete battery?'),
                handler: async (mac) => {
                    await this.adapter.updateBatteries(list => list.filter(b => b.mac !== mac));
                    return { delete: mac };
                },
            },
        ];
        const info = {
            id: bat.mac,
            identifier: bat.mac,
            name: bat.name || bat.mac,
            icon: ICON_BATTERY,
            enabled,
            group: { key: 'battery', name: (0, i18n_1.t)('Batteries'), icon: ICON_BATTERY },
            actions,
        };
        if (!enabled) {
            // A disabled battery has no objects, so there is nothing live to bind to
            info.status = 'disconnected';
            return info;
        }
        actions.unshift({
            id: 'poll',
            icon: 'refresh',
            description: (0, i18n_1.t)('Poll now'),
            handler: async (_mac, context) => {
                await this.poll(context);
                return { refresh: 'none' };
            },
        });
        info.manufacturer = { stateId: this.full(`${devId}.product.manufacturer`) };
        info.model = { stateId: this.full(`${devId}.product.model_or_fw`) };
        info.status = {
            connection: {
                stateId: this.full(`${devId}.reachable`),
                mapping: { true: 'connected', false: 'disconnected' },
            },
            battery: { stateId: this.full(ids.soc) },
            warning: { stateId: this.full(`${devId}.lastError`) },
        };
        info.indicators = this.getIndicators(ids);
        info.customInfo = this.getCustomInfo(bat.mac, ids);
        info.hasDetails = true;
        return info;
    }
    getTotalInfo() {
        return {
            id: TOTAL_ID,
            identifier: 'Σ',
            name: (0, i18n_1.t)('Total'),
            icon: ICON_TOTAL,
            group: { key: 'total', name: (0, i18n_1.t)('Total'), icon: ICON_TOTAL },
            status: { battery: { stateId: this.full(TOTAL_STATES.soc) } },
            indicators: this.getIndicators(TOTAL_STATES),
            customInfo: {
                id: TOTAL_ID,
                schema: {
                    type: 'panel',
                    items: {
                        count: this.stateItem('total.count', (0, i18n_1.t)('Reachable batteries')),
                        remaining: this.stateItem(TOTAL_STATES.remainingAh, (0, i18n_1.t)('Remaining capacity'), 'Ah'),
                        spread: this.stateItem(TOTAL_STATES.cellSpread, (0, i18n_1.t)('Cell spread'), 'mV'),
                    },
                },
            },
            hasDetails: true,
            actions: [
                {
                    id: 'poll',
                    icon: 'refresh',
                    description: (0, i18n_1.t)('Poll now'),
                    handler: async (_id, context) => {
                        await this.poll(context);
                        return { refresh: 'none' };
                    },
                },
            ],
        };
    }
    // ---------------------------------------------------------------------------------------------
    // Details
    stateItem(relId, label, unit) {
        return {
            type: 'state',
            oid: this.full(relId),
            foreign: true,
            label,
            unit,
            xs: 12,
            sm: 6,
        };
    }
    staticItem(label, data, unit) {
        return {
            type: 'staticInfo',
            label,
            data,
            unit,
            xs: 12,
            sm: 6,
        };
    }
    header(text) {
        return { type: 'header', text, size: 4, newLine: true, xs: 12 };
    }
    async readNumber(relId) {
        const state = await this.adapter.getStateAsync(relId);
        return typeof state?.val === 'number' && Number.isFinite(state.val) ? state.val : null;
    }
    async readText(relId) {
        const state = await this.adapter.getStateAsync(relId);
        return state?.val === null || state?.val === undefined ? '' : String(state.val);
    }
    async readNumberList(relId) {
        try {
            const parsed = JSON.parse((await this.readText(relId)) || '[]');
            return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'number') : [];
        }
        catch {
            return [];
        }
    }
    /** Header, all measured values and the state of health computed from full and design capacity */
    async valueItems(ids) {
        const items = {
            _values: this.header((0, i18n_1.t)('State of charge')),
            soc: this.stateItem(ids.soc, (0, i18n_1.t)('State of charge'), '%'),
            voltage: this.stateItem(ids.voltage, (0, i18n_1.t)('Voltage'), 'V'),
            current: this.stateItem(ids.current, (0, i18n_1.t)('Current'), 'A'),
            power: this.stateItem(ids.power, (0, i18n_1.t)('Power'), 'W'),
            mosTemp: this.stateItem(ids.mosTemp, (0, i18n_1.t)('MOSFET temperature'), '°C'),
            pcbTemp: this.stateItem(ids.pcbTemp, (0, i18n_1.t)('PCB temperature'), '°C'),
            _health: this.header((0, i18n_1.t)('Battery health')),
            remaining: this.stateItem(ids.remainingAh, (0, i18n_1.t)('Remaining capacity'), 'Ah'),
            totalAh: this.stateItem(ids.totalAh, (0, i18n_1.t)('Full capacity'), 'Ah'),
            designAh: this.stateItem(ids.designAh, (0, i18n_1.t)('Design capacity'), 'Ah'),
            cycles: this.stateItem(ids.cycles, (0, i18n_1.t)('Cycles')),
            spread: this.stateItem(ids.cellSpread, (0, i18n_1.t)('Cell spread'), 'mV'),
        };
        const full = await this.readNumber(ids.totalAh);
        const design = await this.readNumber(ids.designAh);
        if (full && design) {
            items.soh = this.staticItem((0, i18n_1.t)('State of health'), Math.round((full / design) * 1000) / 10, '%');
        }
        return items;
    }
    async getBatteryDetails(bat) {
        const devId = this.adapter.getDeviceId(bat);
        const ids = batteryStates(devId);
        const items = await this.valueItems(ids);
        const cells = await this.readNumberList(`${devId}.cells_v`);
        if (cells.length) {
            const min = Math.min(...cells);
            const max = Math.max(...cells);
            items._cells = this.header((0, i18n_1.t)('Cell voltages'));
            cells.forEach((v, i) => {
                const color = cells.length > 1 && max > min
                    ? v === max
                        ? '#f44336'
                        : v === min
                            ? '#2196f3'
                            : undefined
                    : undefined;
                items[`cell${i}`] = {
                    ...this.staticItem((0, i18n_1.tWith)('Cell', ` ${i + 1}`), v.toFixed(3), 'V'),
                    sm: 4,
                    md: 3,
                    styleValue: color ? { color, fontWeight: 'bold' } : undefined,
                };
            });
        }
        const temps = await this.readNumberList(`${devId}.cell_temps`);
        if (temps.length) {
            items._temps = this.header((0, i18n_1.t)('Cell temperatures'));
            temps.forEach((v, i) => {
                items[`temp${i}`] = {
                    ...this.staticItem((0, i18n_1.tWith)('Cell', ` ${i + 1}`), v.toFixed(1), '°C'),
                    sm: 4,
                    md: 3,
                };
            });
        }
        items._product = this.header((0, i18n_1.t)('Product info'));
        items.mac = this.staticItem('MAC', bat.mac);
        items.model = this.stateItem(`${devId}.product.model_or_fw`, (0, i18n_1.t)('Model / Firmware'));
        items.manufacturer = this.stateItem(`${devId}.product.manufacturer`, (0, i18n_1.t)('Manufacturer'));
        items.serial = this.stateItem(`${devId}.product.serial`, (0, i18n_1.t)('Serial number'));
        const lastUpdate = await this.readNumber(`${devId}.lastUpdate`);
        items.lastUpdate = this.staticItem((0, i18n_1.t)('Last update'), lastUpdate ? new Date(lastUpdate).toLocaleString() : '—');
        const lastError = await this.readText(`${devId}.lastError`);
        if (lastError) {
            items.lastError = {
                ...this.staticItem((0, i18n_1.t)('Last error'), lastError),
                sm: 12,
                styleValue: { color: '#f44336' },
            };
        }
        return { id: bat.mac, schema: { type: 'panel', items } };
    }
    async getTotalDetails() {
        const items = await this.valueItems(TOTAL_STATES);
        items.count = this.stateItem('total.count', (0, i18n_1.t)('Reachable batteries'));
        const lastUpdate = await this.readNumber('total.lastUpdate');
        items.lastUpdate = this.staticItem((0, i18n_1.t)('Last update'), lastUpdate ? new Date(lastUpdate).toLocaleString() : '—');
        return { id: TOTAL_ID, schema: { type: 'panel', items } };
    }
    // ---------------------------------------------------------------------------------------------
    // Actions
    async poll(context) {
        if (this.adapter.requestPoll()) {
            await context.showMessage((0, i18n_1.t)('Poll cycle started'));
        }
        else {
            await context.showMessage((0, i18n_1.t)('Poll is busy'));
        }
    }
    async onScan(context) {
        if (!this.adapter.isBleReady()) {
            await context.showMessage((0, i18n_1.t)('Bluetooth is not ready'));
            return { refresh: false };
        }
        const progress = await context.openProgress((0, i18n_1.t)('Scanning'), { indeterminate: true });
        let found;
        try {
            found = await this.adapter.scanBatteries();
        }
        catch (e) {
            await progress.close();
            await context.showMessage(e.message);
            return { refresh: false };
        }
        await progress.close();
        const known = new Set(this.getBatteries().map(b => b.mac.toUpperCase()));
        const fresh = found.filter(d => !known.has(d.address.toUpperCase()));
        if (!fresh.length) {
            await context.showMessage((0, i18n_1.t)('No new batteries found'));
            return { refresh: false };
        }
        const items = {
            _info: { type: 'staticText', text: (0, i18n_1.t)('Add selected batteries'), xs: 12 },
        };
        const data = {};
        fresh.forEach((d, i) => {
            items[`add_${i}`] = {
                type: 'checkbox',
                label: `${d.localName || d.address} (${d.address}, ${d.rssi} dBm)`,
                newLine: true,
                xs: 12,
                sm: 6,
            };
            items[`name_${i}`] = {
                type: 'text',
                label: (0, i18n_1.t)('Name'),
                hidden: `!data.add_${i}`,
                xs: 12,
                sm: 6,
            };
            data[`add_${i}`] = true;
            data[`name_${i}`] = d.localName || '';
        });
        const result = await context.showForm({ type: 'panel', items }, { data, title: (0, i18n_1.t)('Found batteries'), buttons: ['apply', 'cancel'] });
        if (!result) {
            return { refresh: false };
        }
        const toAdd = [];
        fresh.forEach((d, i) => {
            if (result[`add_${i}`]) {
                toAdd.push({
                    mac: d.address,
                    name: String(result[`name_${i}`] || d.localName || '').trim(),
                    enabled: true,
                    includeInTotals: true,
                });
            }
        });
        if (!toAdd.length) {
            return { refresh: false };
        }
        await this.adapter.updateBatteries(list => [...list, ...toAdd]);
        await context.showMessage((0, i18n_1.t)('Settings changed'));
        return { refresh: true };
    }
    async onEdit(mac, context) {
        const bat = this.findBattery(mac);
        if (!bat) {
            return { refresh: 'devices' };
        }
        const result = await context.showForm({
            type: 'panel',
            items: {
                name: { type: 'text', label: (0, i18n_1.t)('Name'), xs: 12 },
                enabled: { type: 'checkbox', label: (0, i18n_1.t)('Enabled'), newLine: true, xs: 12 },
                includeInTotals: { type: 'checkbox', label: (0, i18n_1.t)('Include in totals'), newLine: true, xs: 12 },
            },
        }, {
            data: {
                name: bat.name || '',
                enabled: bat.enabled !== false,
                includeInTotals: bat.includeInTotals !== false,
            },
            title: (0, i18n_1.t)('Battery settings'),
            buttons: ['apply', 'cancel'],
        });
        if (!result) {
            return { refresh: 'none' };
        }
        const name = String(result.name ?? '').trim();
        const enabled = !!result.enabled;
        const includeInTotals = !!result.includeInTotals;
        if (name === (bat.name || '') &&
            enabled === (bat.enabled !== false) &&
            includeInTotals === (bat.includeInTotals !== false)) {
            return { refresh: 'none' };
        }
        // Battery objects are named after the battery, so two batteries must not share a name
        const newDevId = this.adapter.getDeviceId({ ...bat, name });
        if (this.getBatteries().some(b => b.mac !== mac && this.adapter.getDeviceId(b) === newDevId)) {
            await context.showMessage((0, i18n_1.t)('Name already used'));
            return { refresh: 'none' };
        }
        await this.adapter.updateBatteries(list => list.map(b => (b.mac === mac ? { ...b, name, enabled, includeInTotals } : b)));
        await context.showMessage((0, i18n_1.t)('Settings changed'));
        return { refresh: 'devices' };
    }
}
exports.WattCycleDeviceManagement = WattCycleDeviceManagement;
//# sourceMappingURL=DeviceManagement.js.map