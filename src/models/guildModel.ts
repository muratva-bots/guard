import { SafeFlags } from '@/enums';
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import { PermissionsString } from 'discord.js';

interface IPermission {
    name: string;
    allow: PermissionsString[];
}

export interface ISafe {
    id: string;
    allow: SafeFlags[];
}

interface IStaff {
    id: string;
    roles: string[];
}

export class GuardClass {
    generalLimitTime: number;
    generalLimitCount: number;
    roleLimitTime: number;
    roleLimitCount: number;
    channelLimitTime: number;
    channelLimitCount: number;
    emojiLimitTime: number;
    emojiLimitCount: number;
    stickerLimitTime: number;
    stickerLimitCount: number;
    banKickLimitTime: number;
    banKickLimitCount: number;
    voiceKickLimitTime: number;
    voiceKickLimitCount: number;
    permissions: IPermission[];
    safes: ISafe[];
    url: boolean;
    disablePerms: boolean;
    general: boolean;
    voiceKick: boolean;
    role: boolean;
    channel: boolean;
    emoji: boolean;
    sticker: boolean;
    banKick: boolean;
    webhook: boolean;
    web: boolean;
    offline: boolean;
    bot: boolean;
    lastChannelDistribution: number;
    lastRoleDistribution: number;
    lastBackup: number;
    danger: boolean;
    staffs: IStaff[];
    quarantineRole: string;
}

@modelOptions({ options: { customName: 'Guilds', allowMixed: 0 } })
export class GuildClass {
    @prop({ type: () => String, required: true, unique: true })
    public id!: string;

    @prop({
        type: Object,
        default: {
            needName: true,
            registerSystem: true,
            invasionProtection: true,
            needAge: true,
            removeWarnRole: true,
            compliment: true,
            changeName: true,
            minAgePunish: true,
            maxMuteSystem: true,
        },
    })
    public moderation: object;

    @prop({ type: Object, default: {
        url: true,
        disablePerms: true,
        general: true,
        voiceKick: true,
        role: true,
        channel: true,
        emoji: true,
        sticker: true,
        banKick: true,
        webhook: true,
        web: true,
        offline: true,
        bot: true
    } })
    public guard: GuardClass;

    @prop({
        type: Object,
        default: {
            messagePoint: 1,
            messageStaffPoint: 2,
            invitePoint: 70,
            sleepPoint: 4,
            publicPoint: 8,
            meetingPoint: 500,
            noMute: true,
            eventFinishTimestamp: Date.now(),
            staffTakePoints: 70,
            taggedPoints: 70
        },
    })
    public point: object;

    @prop({
        type: Object,
        default: {
            removeOldRank: false,
            dailyPublic: 0,
            lastPublic: 0,
            dailyStream: 0,
            lastStream: 0,
            dailyCam: 0,
            lastCam: 0,
            dailyStreamOpen: 0,
            lastStreamOpen: 0,
            dailyCamOpen: 0,
            lastCamOpen: 0,
            dailyGeneral: 0,
            lastGeneral: 0,
            dailyMessage: 0,
            lastMessage: 0,
            dailyAfk: 0,
            lastAfk: 0,
            dailyJoin: 0,
            lastJoin: 0,
            dailyLeave: 0,
            lastLeave: 0,
            camChannels: [],
            dailyVoice: 0,
            lastVoice: 0,
            lastDay: new Date().setHours(0, 0, 0, 0),
            days: 1,
            owneredStreams: []
        },
    })
    public stat: object;
}

export const GuildModel = getModelForClass(GuildClass);
