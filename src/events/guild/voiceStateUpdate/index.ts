import { Events } from 'discord.js';
import voiceMemberKick from './voiceMemberKick';

const VoiceStateUpdate: Guard.IEvent<Events.VoiceStateUpdate> = {
    name: Events.VoiceStateUpdate,
    execute: async (client, _, newState) => {
        try {
            voiceMemberKick(client, _, newState);
            //    memberMuteUpdate(client, oldState, newState)
        } catch (error) {
            console.error('Guild Member Update Error:', error);
        }
    },
};

export default VoiceStateUpdate;
