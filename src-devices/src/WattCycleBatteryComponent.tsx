/**
 * A WattCycle battery as a tile in the devices app.
 *
 * 1x1 shows the SOC arc and the charge state, 2x½ a battery bar with voltage, current and power, 2x1 the
 * arc together with the four values. A click opens a dialog with everything: health, cells and
 * temperatures, like the overview of the WattCycle app.
 *
 * The class draws only the frame of the devices app; the views are the shared ones in `../src-shared`.
 */
import WidgetGeneric, {
    AdapterReact,
    MuiMaterial,
    MuiIcons,
    getTileStyles,
    isNeumorphicTheme,
    type CustomWidgetPlugin,
    type WidgetGenericProps,
    type WidgetGenericState,
} from '@iobroker/dm-widgets';
import type React from 'react';
import type { BoxProps, DialogProps, IconButtonProps, Theme } from '@mui/material';
import type { ConfigItemPanel, ConfigItemTabs } from '@iobroker/dm-utils';

import {
    DEFAULT_DEVICE,
    applyStateValue,
    emptyBatteryValues,
    getMode,
    getStateIds,
    isTotalDevice,
    type BatteryField,
    type BatteryValues,
    type Translate,
} from '../../src-shared/batteryData';
import { BatteryBarView, BatteryCompactView, BatteryFullView, BatteryWideView } from '../../src-shared/BatteryView';
import { I18N_PREFIX } from '../../src-shared/translations';

// React and MUI of the host, so there is only one instance of each
const Box: React.ComponentType<BoxProps> = MuiMaterial?.Box;
const Dialog: React.ComponentType<DialogProps> = MuiMaterial?.Dialog;
const DialogTitle: React.ComponentType<any> = MuiMaterial?.DialogTitle;
const DialogContent: React.ComponentType<any> = MuiMaterial?.DialogContent;
const IconButton: React.ComponentType<IconButtonProps> = MuiMaterial?.IconButton;
const CloseIcon: React.ComponentType<any> = MuiIcons?.Close;

interface WattCycleTileSettings extends CustomWidgetPlugin {
    /** Object ID of a battery device (`wattcycle.0.batteries.Watt3`) or `wattcycle.0.total` */
    device?: string;
    /** Open the dialog with all details on click. Default true */
    openDialog?: boolean;
}

interface WattCycleTileState extends WidgetGenericState {
    values: BatteryValues;
    /** Name of the device object, used if the settings have no name */
    deviceName: string;
    dialogOpen: boolean;
}

function translate(word: string): string {
    return AdapterReact?.I18n ? AdapterReact.I18n.t(`${I18N_PREFIX}${word}`) : word;
}

export class WattCycleBatteryComponent extends WidgetGeneric<WattCycleTileState, WattCycleTileSettings> {
    /** state ID -> value of the view */
    private subscribed: Record<string, BatteryField> = {};
    private subscribedDevice = '';

    private readonly t: Translate = word => translate(word);

    constructor(props: WidgetGenericProps<WattCycleTileSettings>) {
        super(props);
        this.state = {
            ...this.state,
            values: emptyBatteryValues(),
            deviceName: '',
            dialogOpen: false,
        };
    }

    static override getConfigSchema(): { name: string; schema: ConfigItemPanel | ConfigItemTabs } {
        return {
            name: 'WattCycleBattery',
            schema: {
                type: 'panel',
                items: {
                    device: {
                        type: 'objectId',
                        types: 'device',
                        label: 'wattcycle_Device',
                        help: 'wattcycle_Device help',
                        default: DEFAULT_DEVICE,
                        xs: 12,
                    },
                    openDialog: {
                        type: 'checkbox',
                        label: 'wattcycle_Open dialog',
                        default: true,
                        newLine: true,
                        xs: 12,
                    },
                },
            } as ConfigItemPanel,
        };
    }

    private getDevice(): string {
        return this.props.settings.device || DEFAULT_DEVICE;
    }

    componentDidMount(): void {
        super.componentDidMount?.();
        this.subscribe();
    }

    componentDidUpdate(
        prevProps: Readonly<WidgetGenericProps<WattCycleTileSettings>>,
        prevState: Readonly<WattCycleTileState>,
    ): void {
        super.componentDidUpdate?.(prevProps, prevState);
        if (this.getDevice() !== this.subscribedDevice) {
            this.unsubscribe();
            this.subscribe();
        }
    }

    componentWillUnmount(): void {
        super.componentWillUnmount?.();
        this.unsubscribe(true);
    }

    private onStateChange = (id: string, state: ioBroker.State): void => {
        const field = this.subscribed[id];
        if (field) {
            this.setState(prev => ({ values: applyStateValue(prev.values, field, state?.val) }));
        }
    };

    private onNameChange = (_id: string, _property: string, value: unknown): void => {
        let name = '';
        if (typeof value === 'string') {
            name = value;
        } else if (value && typeof value === 'object') {
            const lang = (this.props.stateContext.language || 'en') as ioBroker.Languages;
            const translated = value as ioBroker.Translated;
            name = translated[lang] || translated.en || '';
        }
        this.setState({ deviceName: name });
    };

    private subscribe(): void {
        const device = this.getDevice();
        this.subscribedDevice = device;
        const ids = getStateIds(device);
        this.subscribed = {};
        for (const [field, id] of Object.entries(ids)) {
            if (id) {
                this.subscribed[id] = field as BatteryField;
                this.props.stateContext.getState(id, this.onStateChange);
            }
        }
        this.props.stateContext.getObjectProperty(device, 'common.name', this.onNameChange);
    }

    private unsubscribe(unmount?: boolean): void {
        for (const id of Object.keys(this.subscribed)) {
            this.props.stateContext.removeState(id, this.onStateChange);
        }
        this.subscribed = {};
        if (this.subscribedDevice) {
            void this.props.stateContext.removeObject(this.subscribedDevice, this.onNameChange);
        }
        this.subscribedDevice = '';
        if (!unmount) {
            this.setState({ values: emptyBatteryValues(), deviceName: '' });
        }
    }

    private getName(): string {
        if (this.props.settings.name) {
            return this.props.settings.name;
        }
        // The object name of `total` is a description, not a name
        return isTotalDevice(this.getDevice()) ? this.t('Batteries') : this.state.deviceName;
    }

    protected isTileActive(): boolean {
        const mode = getMode(this.state.values);
        return mode === 'charging' || mode === 'discharging';
    }

    private onClick = (): void => {
        if (this.props.settings.openDialog !== false) {
            this.setState({ dialogOpen: true });
        }
    };

    /** The tile's frame in the style of the devices app */
    private renderFrame(
        outer: (theme: Theme) => React.CSSProperties,
        inner: React.CSSProperties,
        content: React.JSX.Element,
    ): React.JSX.Element {
        const isActive = this.isTileActive();
        const accent = this.getAccentColor();
        const indicators = this.renderIndicators(this.renderSettingsButton());
        return (
            <Box
                id={String(this.props.widget.id)}
                className={this.getWidgetClass()}
                sx={theme => outer(theme)}
            >
                <Box
                    onClick={this.onClick}
                    sx={theme => ({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        overflow: 'hidden',
                        position: 'relative',
                        cursor: this.props.settings.openDialog !== false ? 'pointer' : undefined,
                        ...(getTileStyles(theme, isActive, accent) as React.CSSProperties),
                        ...inner,
                        padding: isNeumorphicTheme(theme) ? 'max(10px, 6cqi)' : 'max(12px, 7cqi)',
                    })}
                >
                    {indicators}
                    {content}
                </Box>
            </Box>
        );
    }

    renderCompact(): React.JSX.Element {
        return this.renderFrame(
            theme => WidgetGeneric.getStyleCompact(theme),
            { aspectRatio: '1' },
            <BatteryCompactView
                values={this.state.values}
                t={this.t}
                isFloatComma={this.props.stateContext.isFloatComma}
                name={this.getName()}
            />,
        );
    }

    /** 2x½: a thin bar */
    renderWide(): React.JSX.Element {
        return this.renderFrame(
            theme => ({ ...WidgetGeneric.getStyleWide(theme), height: 80 }),
            { height: '100%', paddingTop: 0, paddingBottom: 0 },
            <BatteryBarView
                values={this.state.values}
                t={this.t}
                isFloatComma={this.props.stateContext.isFloatComma}
                name={this.getName()}
            />,
        );
    }

    /** 2x1: arc and values */
    renderWideTall(): React.JSX.Element {
        return this.renderFrame(
            theme => WidgetGeneric.getStyleWideTall(theme),
            { aspectRatio: '2' },
            <BatteryWideView
                values={this.state.values}
                t={this.t}
                isFloatComma={this.props.stateContext.isFloatComma}
                name={this.getName()}
            />,
        );
    }

    private renderDialog(): React.JSX.Element | null {
        if (!this.state.dialogOpen) {
            return null;
        }
        const close = (): void => this.setState({ dialogOpen: false });
        return (
            <Dialog
                open
                onClose={close}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ pr: 6 }}>{this.getName() || this.t('Battery')}</DialogTitle>
                <IconButton
                    onClick={close}
                    sx={{ position: 'absolute', top: 8, right: 8 }}
                >
                    <CloseIcon />
                </IconButton>
                <DialogContent>
                    <BatteryFullView
                        values={this.state.values}
                        t={this.t}
                        isFloatComma={this.props.stateContext.isFloatComma}
                        name={this.getName()}
                    />
                </DialogContent>
            </Dialog>
        );
    }

    render(): React.JSX.Element {
        const widget = super.render();
        const dialog = this.renderDialog();
        if (dialog) {
            return (
                <>
                    {widget}
                    {dialog}
                </>
            );
        }
        return widget;
    }
}

export default WattCycleBatteryComponent;
