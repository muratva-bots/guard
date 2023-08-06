import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose';

export interface IChannelOverwrite {
    id: string;
    permissions: Guard.IPermissions;
}

@modelOptions({ options: { customName: 'Roles', allowMixed: 0 } })
export class RoleClass {
    @prop({ type: () => String, required: true, unique: true })
    public id!: string;

    @prop({ type: () => String, required: true })
    public guild!: string;

    @prop({ type: () => String, required: true })
    public name!: string;

    @prop({ type: () => Number, required: true })
    public color!: number;

    @prop({ type: () => Number, required: true })
    public position!: number;

    @prop({ type: () => String, required: true })
    public permissions!: string;

    @prop({ type: () => [Object], default: [] })
    public channelOverwrites!: IChannelOverwrite[];

    @prop({ type: () => [String], default: [] })
    public members!: string[];

    @prop({ type: () => String, default: undefined })
    public iconBase64?: string;

    @prop({ type: () => Boolean, default: false })
    public mentionable!: boolean;

    @prop({ type: () => Boolean, default: false })
    public hoist!: boolean;
}

export const RoleModel = getModelForClass(RoleClass);
