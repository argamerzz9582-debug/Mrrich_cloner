import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Client } from 'discord.js-selfbot-v13';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server);

// 👇 Apna Admin Password yahan change kar sakte ho
const ADMIN_SECRET = "roxyadmin2026"; 
let activeSessionsCount = 0;
let totalCompletedClones = 0;

app.use(express.static(path.join(__dirname, 'public')));
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

io.on('connection', (socket) => {

    // Admin Auth Room
    socket.on('admin_login', (password) => {
        if (password === ADMIN_SECRET) {
            socket.join('admin_room');
            socket.emit('admin_auth', { success: true });
            socket.emit('admin_stats', { activeSessionsCount, totalCompletedClones });
        } else {
            socket.emit('admin_auth', { success: false });
        }
    });

    // Main Cloning Logic
    socket.on('start_clone', async (data) => {
        let { userToken, sourceId, targetId, options } = data;
        let client = new Client({ checkUpdate: false });

        const log = (msg) => socket.emit('log', msg);
        const progress = (percent) => socket.emit('progress', percent);

        const adminLog = (msg) => io.to('admin_room').emit('admin_log', msg);
        const updateAdminStats = () => io.to('admin_room').emit('admin_stats', { activeSessionsCount, totalCompletedClones });

        activeSessionsCount++;
        updateAdminStats();

        const cleanup = () => {
            if (client) { client.destroy(); client = null; }
            userToken = null; // Memory wipe for security
            activeSessionsCount = Math.max(0, activeSessionsCount - 1);
            updateAdminStats();
        };

        client.on('ready', async () => {
            log(`🔒 Auth Verified: ${client.user.tag}`);
            adminLog(`⚡ [SYSTEM SESSION TRIGGERED] Source: ${sourceId} ➔ Target: ${targetId}`);
            progress(5);

            const sourceGuild = client.guilds.cache.get(sourceId);
            const targetGuild = client.guilds.cache.get(targetId);

            if (!sourceGuild || !targetGuild) {
                log('❌ Error: Source ya Target Server tak access nahi mila!');
                adminLog(`❌ Operation Failed: Server Access Error`);
                cleanup(); return;
            }

            log(`🚀 Syncing: ${sourceGuild.name} ➔ ${targetGuild.name}`);
            progress(15);

            try {
                // 1. CLEANING
                log('🧹 Cleaning target server...');
                for (const channel of targetGuild.channels.cache.values()) await channel.delete().catch(()=>{});
                for (const role of targetGuild.roles.cache.values()) {
                    if (role.editable && role.name !== '@everyone') await role.delete().catch(()=>{});
                }
                progress(25);

                // 2. PROFILE
                log('🖼️ Copying Profile & Icon...');
                await targetGuild.setName(sourceGuild.name).catch(()=>{});
                if (sourceGuild.iconURL()) await targetGuild.setIcon(sourceGuild.iconURL({ dynamic: true, size: 4096 })).catch(()=>{});
                progress(35);

                // 3. ROLES
                const roleMap = new Map();
                if (options.cloneRoles) {
                    log('🎭 Cloning Roles...');
                    const sortedRoles = [...sourceGuild.roles.cache.values()].sort((a, b) => a.position - b.position);
                    for (const role of sortedRoles) {
                        if (role.name === '@everyone') {
                            const everyone = targetGuild.roles.cache.find(r => r.name === '@everyone');
                            if (everyone) await everyone.setPermissions(role.permissions).catch(()=>{});
                            roleMap.set(role.id, everyone.id);
                            continue;
                        }
                        const newRole = await targetGuild.roles.create({
                            name: role.name, color: role.color, hoist: role.hoist, permissions: role.permissions, mentionable: role.mentionable
                        }).catch(() => null);
                        if (newRole) roleMap.set(role.id, newRole.id);
                    }
                }
                progress(55);

                // 4. CHANNELS
                const channelMap = new Map();
                if (options.cloneChannels) {
                    log('📁 Cloning Categories & Channels...');
                    const catMap = new Map();
                    for (const [, cat] of sourceGuild.channels.cache.filter(c => c.type === 'GUILD_CATEGORY').sort((a,b)=>a.position-b.position)) {
                        const newCat = await targetGuild.channels.create(cat.name, { type: 'GUILD_CATEGORY' }).catch(()=>null);
                        if (newCat) catMap.set(cat.id, newCat.id);
                    }

                    for (const [, ch] of sourceGuild.channels.cache.filter(c => c.type !== 'GUILD_CATEGORY').sort((a,b)=>a.position-b.position)) {
                        const parentId = ch.parentId ? catMap.get(ch.parentId) : null;
                        const newChannel = await targetGuild.channels.create(ch.name, {
                            type: ch.type, topic: ch.topic, nsfw: ch.nsfw, bitrate: ch.bitrate, parent: parentId
                        }).catch(()=>null);
                        if (newChannel) channelMap.set(ch.id, newChannel);
                    }
                }
                progress(75);

                // 5. MESSAGES
                if (options.cloneMessages && options.cloneChannels) {
                    const limit = parseInt(options.msgLimit) || 15;
                    log(`💬 Syncing Messages (Max ${limit} msgs/channel)...`);
                    for (const [sourceId, targetChannel] of channelMap) {
                        const sourceChannel = sourceGuild.channels.cache.get(sourceId);
                        if (sourceChannel && sourceChannel.isText() && targetChannel.isText()) {
                            try {
                                const messages = await sourceChannel.messages.fetch({ limit: limit });
                                if (messages.size > 0) {
                                    const webhook = await targetChannel.createWebhook('Cloner', { avatar: client.user.displayAvatarURL() });
                                    const msgArray = Array.from(messages.values()).reverse();
                                    for (const msg of msgArray) {
                                        if (msg.content || msg.attachments.size > 0) {
                                            await webhook.send({
                                                content: msg.content || ' ', username: msg.author.username,
                                                avatarURL: msg.author.displayAvatarURL({ dynamic: true }),
                                                files: msg.attachments.map(a => a.url)
                                            }).catch(()=>{});
                                            await sleep(1500);
                                        }
                                    }
                                    await webhook.delete().catch(()=>{});
                                }
                            } catch (e) {}
                        }
                    }
                }
                progress(100);
                log('🎉 LIQUID CLONING COMPLETED SUCCESSFULLY!');
                adminLog(`✅ Task Completed Successfully.`);
                totalCompletedClones++;
                cleanup();

            } catch (err) {
                log(`❌ Error: ${err.message}`);
                adminLog(`❌ Operation Error: ${err.message}`);
                cleanup();
            }
        });

        client.login(userToken).catch(() => {
            log('❌ Invalid Token Provided!');
            cleanup();
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server & Safe Dashboard Running on port ${PORT}`));
