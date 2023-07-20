import { ISettings } from '@/models';
import { Client } from '@/structures';
import { ClientEvents, Message, PermissionsString } from 'discord.js';

export { }

declare global {
    namespace Guard {
        type EventKeys = keyof ClientEvents;

        type IPermissions = {
            [key in PermissionsString]: boolean | null;
        };        

        interface ILimit {
            operations: string[];
            lastDate: number;
        }

        interface IEvent<K extends EventKeys> {
            name: EventKeys;
            execute: (client: Client, ...args: ClientEvents[K]) => Promise<void> | void;
        }

        interface ICommand {
            usages: string[];
            execute: (commandArgs: CommandArgs) => Promise<unknown> | unknown;
        }

        interface CommandArgs {
            client: Client;
            message: Message;
            args: string[];
            guildData: ISettings;
        }
    }
}
