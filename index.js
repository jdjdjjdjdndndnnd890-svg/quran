const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');
const sodium = require('libsodium-wrappers');

const { 
    Client, GatewayIntentBits, SlashCommandBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, 
    TextInputStyle, ChannelType, MessageFlags
} = require('discord.js');

const { 
    joinVoiceChannel, createAudioPlayer, createAudioResource, 
    AudioPlayerStatus, VoiceConnectionStatus, entersState, StreamType,
    getVoiceConnection, generateDependencyReport
} = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

// طباعة تقرير المكتبات الصوتية للتأكد من جاهزيتها في اللوق
console.log("📊 تقرير المكتبات الصوتية:\n", generateDependencyReport());

const reciters = [
    { id: 'afs', name: 'مشاري العفاسي', keywords: ['عفاسي', 'مشاري'], url: 'https://server8.mp3quran.net/afs/' },
    { id: 'dosr', name: 'ياسر الدوسري', keywords: ['دوسري', 'ياسر'], url: 'https://server11.mp3quran.net/dosr/' },
    { id: 'minsh', name: 'محمد صديق المنشاوي', keywords: ['منشاوي', 'منش'], url: 'https://server10.mp3quran.net/minsh/' },
    { id: 'shat', name: 'أبو بكر الشاطري', keywords: ['شاطري', 'شاطر'], url: 'https://server11.mp3quran.net/shat/' },
    { id: 'shur', name: 'سعود الشريم', keywords: ['شريم', 'سعود'], url: 'https://server7.mp3quran.net/shur/' },
    { id: 'sds', name: 'عبد الرحمن السديس', keywords: ['سديس', 'عبدالرحمن'], url: 'https://server7.mp3quran.net/sds/' },
    { id: 'ajm', name: 'أحمد العجمي', keywords: ['عجمي', 'احمد'], url: 'https://server10.mp3quran.net/ajm/' },
    { id: 'maher', name: 'ماهر المعيقلي', keywords: ['معيقلي', 'ماهر'], url: 'https://server12.mp3quran.net/maher/' }
];

const surahNames = [
    "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
    "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
    "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
    "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
    "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
    "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
    "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
    "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
    "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
    "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
    "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "المعون", "الكوثر", "الكافرون", "النصر",
    "المسد", "الإخلاص", "الفلق", "الناس"
];

let mainSurahIndex = 1;        
let mainReciter = reciters[0];  

let isCustomRequest = false;    
let customSurahIndex = null;
let customReciter = null;

let volume = 1.0;
let connection = null;
const player = createAudioPlayer();
let currentResource = null;
let currentFFmpegProcess = null;
let panelMessageData = { channelId: null, messageId: null };

function getSurahUrl(surahIndex, reciter) {
    const formattedIndex = String(surahIndex).padStart(3, '0');
    return `${reciter.url}${formattedIndex}.mp3`;
}

function playSurahStream(surahIndex, reciter) {
    const url = getSurahUrl(surahIndex, reciter);
    console.log(`▶️ جاري تشغيل الرابط: ${url}`);

    if (currentFFmpegProcess) {
        try { currentFFmpegProcess.kill('SIGKILL'); } catch (e) {}
        currentFFmpegProcess = null;
    }

    currentFFmpegProcess = spawn(ffmpegPath, [
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        '-i', url,
        '-filter:a', `volume=${volume}`,
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'ignore'] });

    currentResource = createAudioResource(currentFFmpegProcess.stdout, { 
        inputType: StreamType.Raw
    });

    player.play(currentResource);
}

function normalizeText(text) {
    return text
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u0652]/g, '')
        .toLowerCase()
        .trim();
}

function createPanelEmbed() {
    const currentIdx = isCustomRequest ? customSurahIndex : mainSurahIndex;
    const currentRec = isCustomRequest ? customReciter : mainReciter;
    const statusNote = isCustomRequest ? ' ⚠️ (طلب خاص - ستستأنف الختمة بعدها)' : ' 🔄 (ختمة مستمرة)';

    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('📖 إذاعة القرآن الكريم - 24/7')
        .addFields(
            { name: '🎙️ القارئ الحالي', value: `**${currentRec.name}**`, inline: true },
            { name: '📜 السورة الشغالة', value: `**سورة ${surahNames[currentIdx - 1]}** (${currentIdx}/114)${statusNote}`, inline: false },
            { name: '🔊 مستوى الصوت', value: `\`${Math.round(volume * 100)}%\``, inline: true }
        )
        .setFooter({ text: 'البوت يعمل باستمرار 24/7 بدون توقف' });

    const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_prev').setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_search').setEmoji('🔍').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_next').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_vol_down').setEmoji('🔉').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_vol_up').setEmoji('🔊').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [rowButtons] };
}

function handleSurahEnd() {
    if (isCustomRequest) {
        isCustomRequest = false;
        customSurahIndex = null;
        customReciter = null;
    } else {
        mainSurahIndex = (mainSurahIndex % 114) + 1;
    }

    const activeIdx = isCustomRequest ? customSurahIndex : mainSurahIndex;
    const activeRec = isCustomRequest ? customReciter : mainReciter;
    playSurahStream(activeIdx, activeRec);
    updatePanelMessage();
}

player.on(AudioPlayerStatus.Idle, () => {
    handleSurahEnd();
});

player.on('error', (err) => {
    console.error("❌ خطأ المشغل:", err.message);
});

async function updatePanelMessage() {
    if (!panelMessageData.channelId || !panelMessageData.messageId) return;
    try {
        const channel = await client.channels.fetch(panelMessageData.channelId);
        const msg = await channel.messages.fetch(panelMessageData.messageId);
        await msg.edit(createPanelEmbed());
    } catch (err) {}
}

// تعديل حدث التشغيل لتفادي DeprecationWarning
client.on('clientReady', async () => {
    console.log(`🤖 تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
    await sodium.ready; // التأكد من تجهيز مكتبة التشفير

    const setupCommand = new SlashCommandBuilder()
        .setName('setup-quran')
        .setDescription('تحديد الروم الصوتية وتثبيت بانل التحكم بالقرآن')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('اختر الروم الصوتية')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true)
        );

    await client.application.commands.set([setupCommand]);
});

client.on('interactionCreate', async (interaction) => {

    if (interaction.isChatInputCommand() && interaction.commandName === 'setup-quran') {
        const voiceChannel = interaction.options.getChannel('channel');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // تنظيف البانل القديم
        if (panelMessageData.channelId && panelMessageData.messageId) {
            try {
                const oldChannel = await client.channels.fetch(panelMessageData.channelId);
                const oldMsg = await oldChannel.messages.fetch(panelMessageData.messageId);
                await oldMsg.delete();
            } catch (e) {}
        }

        // إغلاق أي اتصال صوتي سابق بشكل كامل ونظيف
        const oldConn = getVoiceConnection(voiceChannel.guild.id);
        if (oldConn) {
            try { 
                oldConn.disconnect();
                oldConn.destroy(); 
            } catch (e) {}
        }

        // إنشاء الاتصال الصوتي الجديد
        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false
        });

        connection.on('stateChange', (oldState, newState) => {
            console.log(`📡 حالة الاتصال: ${oldState.status} ➔ ${newState.status}`);
        });

        connection.on('error', (err) => {
            console.error("❌ خطأ الاتصال الصوتي:", err.message);
        });

        // حماية ومعالجة انقطاع الشبكة التلقائي
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch (error) {
                try { connection.destroy(); } catch (e) {}
            }
        });

        connection.subscribe(player);

        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
            console.log("✅ الاتصال الصوتي مكتمل وجاهز 100%!");
        } catch (error) {
            console.log("⚠️ تعذر تأكيد الاتصال التلقائي بسرعة، جاري البدء المباشر...");
        }

        const panelMsg = await voiceChannel.send(createPanelEmbed());
        panelMessageData = { channelId: voiceChannel.id, messageId: panelMsg.id };

        mainSurahIndex = 1;
        isCustomRequest = false;
        playSurahStream(mainSurahIndex, mainReciter);

        return interaction.editReply({ content: `✅ تم ربط البوت بـ **${voiceChannel.name}** وبدأت الإذاعة المباشرة!` });
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'btn_search') {
            const modal = new ModalBuilder()
                .setCustomId('search_modal')
                .setTitle('🔍 اختيار سورة أو قارئ');

            const surahInput = new TextInputBuilder()
                .setCustomId('surah_input')
                .setLabel("اكتب اسم السورة أو رقمها واسم الشيخ")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("مثال: الكهف بصوت ياسر الدوسري")
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(surahInput);
            modal.addComponents(row);
            return interaction.showModal(modal);
        }

        await interaction.deferUpdate();

        if (interaction.customId === 'btn_next') {
            handleSurahEnd();
        } 
        else if (interaction.customId === 'btn_prev') {
            if (isCustomRequest) {
                isCustomRequest = false;
            } else {
                mainSurahIndex = mainSurahIndex <= 1 ? 114 : mainSurahIndex - 1;
            }
            playSurahStream(mainSurahIndex, mainReciter);
        } 
        else if (interaction.customId === 'btn_vol_up') {
            volume = Math.min(volume + 0.1, 2.0);
            const activeIndex = isCustomRequest ? customSurahIndex : mainSurahIndex;
            const activeReciter = isCustomRequest ? customReciter : mainReciter;
            playSurahStream(activeIndex, activeReciter);
        } 
        else if (interaction.customId === 'btn_vol_down') {
            volume = Math.max(volume - 0.1, 0.0);
            const activeIndex = isCustomRequest ? customSurahIndex : mainSurahIndex;
            const activeReciter = isCustomRequest ? customReciter : mainReciter;
            playSurahStream(activeIndex, activeReciter);
        }

        await updatePanelMessage();
    }

    if (interaction.isModalSubmit() && interaction.customId === 'search_modal') {
        let rawInput = interaction.fields.getTextInputValue('surah_input');
        let normInput = normalizeText(rawInput);

        let matchedReciter = null;
        for (const rec of reciters) {
            for (const kw of rec.keywords) {
                if (normInput.includes(normalizeText(kw))) {
                    matchedReciter = rec;
                    break;
                }
            }
            if (matchedReciter) break;
        }

        let cleanForSurah = normInput
            .replace(/سوره|سورة|بصوت|صوت|الشيخ|قارئ|القارئ/g, '')
            .trim();

        if (matchedReciter) {
            matchedReciter.keywords.forEach(kw => {
                cleanForSurah = cleanForSurah.replace(normalizeText(kw), '');
            });
            cleanForSurah = cleanForSurah.trim();
        }

        let foundIndex = -1;

        const numberMatch = cleanForSurah.match(/\d+/);
        if (numberMatch) {
            const num = parseInt(numberMatch[0]);
            if (num >= 1 && num <= 114) foundIndex = num;
        }

        if (foundIndex === -1 && cleanForSurah.length > 0) {
            let exactIdx = surahNames.findIndex(s => normalizeText(s) === cleanForSurah);
            if (exactIdx !== -1) {
                foundIndex = exactIdx + 1;
            } else {
                let partialIdx = surahNames.findIndex(s => normalizeText(s).includes(cleanForSurah) || cleanForSurah.includes(normalizeText(s)));
                if (partialIdx !== -1) foundIndex = partialIdx + 1;
            }
        }

        if (foundIndex !== -1 || matchedReciter) {
            isCustomRequest = true;
            customSurahIndex = foundIndex !== -1 ? foundIndex : mainSurahIndex;
            customReciter = matchedReciter || mainReciter;

            playSurahStream(customSurahIndex, customReciter);
            await updatePanelMessage();
            await interaction.reply({ 
                content: `▶️ تم تشغيل سورة **${surahNames[customSurahIndex - 1]}** بصوت **${customReciter.name}** كطلب خاص. ستستأنف الختمة تلقائياً بعد انتهائها!`, 
                flags: MessageFlags.Ephemeral 
            });
        } else {
            await interaction.reply({ content: `❌ لم يتم العثور على سورة بهذا الاسم: "${rawInput}"`, flags: MessageFlags.Ephemeral });
        }
    }
});

client.login(process.env.BOT_TOKEN);


