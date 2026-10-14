import { DeviceManagement, type DeviceDetails, type DeviceLoadContext, type InstanceDetails } from '@iobroker/dm-utils';
import type { AdapterInstance } from '@iobroker/adapter-core';
import type { BatteryEntry, WattCycleAdapterConfig } from '../types';
import type { ScanResult } from './battery';
/** What the device manager needs from the adapter */
export interface WattCycleAdapterApi extends AdapterInstance {
    config: WattCycleAdapterConfig;
    getDeviceId(bat: BatteryEntry): string;
    isBleReady(): boolean;
    requestPoll(): boolean;
    scanBatteries(): Promise<ScanResult[]>;
    updateBatteries(mutate: (batteries: BatteryEntry[]) => BatteryEntry[]): Promise<void>;
}
export declare class WattCycleDeviceManagement extends DeviceManagement<WattCycleAdapterApi> {
    private full;
    private getBatteries;
    private findBattery;
    protected getInstanceInfo(): InstanceDetails;
    protected loadDevices(context: DeviceLoadContext<string>): void;
    protected getDeviceDetails(id: string): Promise<DeviceDetails<string> | null | {
        error: string;
    }>;
    private getIndicators;
    private getCustomInfo;
    private getBatteryInfo;
    private getTotalInfo;
    private stateItem;
    /** A line on the card: the card is narrow, so it always takes the full width */
    private cardItem;
    private staticItem;
    private header;
    private readNumber;
    private readText;
    private readNumberList;
    /** Header, all measured values and the state of health computed from full and design capacity */
    private valueItems;
    private getBatteryDetails;
    private getTotalDetails;
    private poll;
    private onScan;
    private onEdit;
}
