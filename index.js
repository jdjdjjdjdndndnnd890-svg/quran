// تحديد مسار FFmpeg لضمان تشغيل الصوت على Railway و Linux
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;

const https = require('https');
const { 
    Client, GatewayIntentBits, SlashCommandBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, 
    TextInputStyle, ChannelType, StringSelectMenuBuilder 
} = require('discord.js');
const { 
    joinVoiceChannel, createAudioPlayer, createAudioResource, 
    AudioPlayerStatus 
} = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

// قائمة القراء المتاحين
const reciters = [
    { id: 'afs', name: 'مشاري العفاسي', keywords: ['عفاسي', 'مشاري'], url: 'https://server8.mp3quran.net/afs/' },
    { id: 'dosr', name: 'ياسر الدوسري', keywords: ['دوسري', 'ياسر'], url: 'https://server11.mp3quran.net/dosr/' },
    { id: 'minsh', name: 'محمد صديق المنشاوي', keywords: ['منشاوي', 'منش'], url: 'https://server10.mp3quran.net/minsh/' },
    { id: 'shat', name: 'أبو بكر الشاطري', keywords: ['شاطري', 'شاطر'], url: 'https://server11.mp3quran.net/shat/' },
    { id: 'shur', name: 'سعود الشريم', keywords: ['شريم', 'سعود'], url: 'https://server7.mp3quran.net/shur/' },
    { id: 'sds', name: 'عبد الرحمن السديس', keywords: ['سديس', 'عبدالرحمن'], url: 'https://server11.mp3quran.net/sds/' },
    { id: 'ajm', name: 'أحمد العجمي', keywords: ['عجمي', 'احمد'], url: 'https://server10.mp3quran.net/ajm/' },
    { id: 'maher', name: 'ماهر المعيقلي', keywords: ['معيقلي', 'ماهر'], url: 'https://server12.mp3quran.net/maher/' }
];

// أسماء السور (114 سورة)
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

let currentSurahIndex = 1;
let currentReciter = reciters[0];
let volume = 1.0;
let connection = null;
const player = createAudioPlayer();
let currentResource = null;
let panelMessageData = { channelId: null, messageId: null };

function getSurahUrl(surahIndex, reciter) {
    const formattedIndex = String(surahIndex).padStart(3, '0');
    return `${reciter.url}${formattedIndex}.mp3`;
}

// تشغيل السورة بأسلوب البث المباشر المضمون للصوت
function playSurah(index) {
    currentSurahIndex = index;
    const url = getSurahUrl(currentSurahIndex, currentReciter);
    
    https.get(url, (stream) => {
        currentResource = createAudioResource(stream, { inlineVolume: true });
        currentResource.volume.setVolume(volume);
        player.play(currentResource);
    }).on('error', (err) => {
        console.error("خطأ في تشغيل رابط الصوت:", err.message);
    });
}

// تنظيف النصوص للبحث الدقيق
function normalizeText(text) {
    return text
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u0652]/g, '') // إزالة التشكيل
        .toLowerCase()
        .trim();
}

// تصميم البانل الجديد (رمادي بالكامل + إيموجيات فقط)
function createPanelEmbed() {
    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('📖 إذاعة القرآن الكريم - 24/7')
        .addFields(
            { name: '🎙️ القارئ الحالي', value: `**${currentReciter.name}**`, inline: true },
            { name: '📜 السورة الشغالة', value: `**سورة ${surahNames[currentSurahIndex - 1]}** (${currentSurahIndex}/114)`, inline: true },
            { name: '🔊 مستوى الصوت', value: `\`${Math.round(volume * 100)}%\``, inline: true }
        )
        .setFooter({ text: 'البوت يعمل باستمرار 24/7 بدون توقف' });

    const reciterSelect = new StringSelectMenuBuilder()
        .setCustomId('select_reciter')
        .setPlaceholder('اختر القارئ (الشيخ) من هنا...')
        .addOptions(
            reciters.map(r => ({
                label: r.name,
                value: r.id,
                default: r.id === currentReciter.id
            }))
        );

    const rowReciter = new ActionRowBuilder().addComponents(reciterSelect);

    // صف الأزرار (كلها رمادية وبدون كلام - إيموجي فقط)
    const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_prev').setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_search').setEmoji('🔍').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_next').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_vol_down').setEmoji('🔉').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_vol_up').setEmoji('🔊').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [rowReciter, rowButtons] };
}

player.on(AudioPlayerStatus.Idle, () => {
    currentSurahIndex = (currentSurahIndex % 114) + 1;
    playSurah(currentSurahIndex);
    updatePanelMessage();
});

async function updatePanelMessage() {
    if (!panelMessageData.channelId || !panelMessageData.messageId) return;
    try {
        const channel = await client.channels.fetch(panelMessageData.channelId);
        const msg = await channel.messages.fetch(panelMessageData.messageId);
        await msg.edit(createPanelEmbed());
    } catch (err) {
        console.log("تعذر تحديث البانل:", err.message);
    }
}

client.on('ready', async () => {
    console.log(`🤖 تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);

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

    // 1. أمر Setup
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup-quran') {
        const voiceChannel = interaction.options.getChannel('channel');
        await interaction.deferReply({ ephemeral: true });

        if (panelMessageData.channelId && panelMessageData.messageId) {
            try {
                const oldChannel = await client.channels.fetch(panelMessageData.channelId);
                const oldMsg = await oldChannel.messages.fetch(panelMessageData.messageId);
                await oldMsg.delete();
            } catch (e) {}
        }

        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false
        });

        connection.subscribe(player);

        const panelMsg = await voiceChannel.send(createPanelEmbed());
        panelMessageData = { channelId: voiceChannel.id, messageId: panelMsg.id };

        playSurah(currentSurahIndex);

        return interaction.editReply({ content: `✅ تم ربط البوت بـ **${voiceChannel.name}** وإرسال البانل بنجاح!` });
    }

    // 2. اختيار القارئ
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_reciter') {
        await interaction.deferUpdate();
        const selectedId = interaction.values[0];
        const reciterObj = reciters.find(r => r.id === selectedId);

        if (reciterObj) {
            currentReciter = reciterObj;
            playSurah(currentSurahIndex);
            await updatePanelMessage();
        }
    }

    // 3. أزرار التحكم
    if (interaction.isButton()) {
        if (interaction.customId === 'btn_search') {
            const modal = new ModalBuilder()
                .setCustomId('search_modal')
                .setTitle('🔍 اختيار سورة أو قارئ');

            const surahInput = new TextInputBuilder()
                .setCustomId('surah_input')
                .setLabel("اكتب اسم السورة أو رقمها (وممكن اسم الشيخ)")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("مثال: الرحمن بصوت ياسر الدوسري")
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(surahInput);
            modal.addComponents(row);
            return interaction.showModal(modal);
        }

        await interaction.deferUpdate();

        if (interaction.customId === 'btn_next') {
            currentSurahIndex = (currentSurahIndex % 114) + 1;
            playSurah(currentSurahIndex);
        } 
        else if (interaction.customId === 'btn_prev') {
            currentSurahIndex = currentSurahIndex <= 1 ? 114 : currentSurahIndex - 1;
            playSurah(currentSurahIndex);
        } 
        else if (interaction.customId === 'btn_vol_up') {
            volume = Math.min(volume + 0.1, 2.0);
            if (currentResource) currentResource.volume.setVolume(volume);
        } 
        else if (interaction.customId === 'btn_vol_down') {
            volume = Math.max(volume - 0.1, 0.0);
            if (currentResource) currentResource.volume.setVolume(volume);
        }

        await updatePanelMessage();
    }

    // 4. معالجة البحث الذكي (Modal)
    if (interaction.isModalSubmit() && interaction.customId === 'search_modal') {
        let rawInput = interaction.fields.getTextInputValue('surah_input');
        let normInput = normalizeText(rawInput);

        // أولاً: فحص إذا كان المستخدم ذكر اسم شيخ في البحث
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

        if (matchedReciter) {
            currentReciter = matchedReciter;
        }

        // ثانياً: تنظيف النص للبحث عن اسم السورة بالظبط
        let cleanForSurah = normInput
            .replace(/سوره|سوره|بصوت|صوت|الشيخ|قارئ|القارئ/g, '')
            .trim();

        // إزالة اسم الشيخ من نص بحث السورة إن وجد
        if (matchedReciter) {
            matchedReciter.keywords.forEach(kw => {
                cleanForSurah = cleanForSurah.replace(normalizeText(kw), '');
            });
            cleanForSurah = cleanForSurah.trim();
        }

        let foundIndex = -1;

        // البحث بالرقم
        const numberMatch = cleanForSurah.match(/\d+/);
        if (numberMatch) {
            const num = parseInt(numberMatch[0]);
            if (num >= 1 && num <= 114) foundIndex = num;
        }

        // البحث بالاسم
        if (foundIndex === -1 && cleanForSurah.length > 0) {
            // 1. بحث عن مطابقة تامة أولاً
            let exactIdx = surahNames.findIndex(s => normalizeText(s) === cleanForSurah);
            if (exactIdx !== -1) {
                foundIndex = exactIdx + 1;
            } else {
                // 2. بحث يحتوي على الكلمة
                let partialIdx = surahNames.findIndex(s => normalizeText(s).includes(cleanForSurah) || cleanForSurah.includes(normalizeText(s)));
                if (partialIdx !== -1) foundIndex = partialIdx + 1;
            }
        }

        // لو ما لاقاش سورة محددة بس لقى شيخ، يشغل نفس السورة الحالية بالشيخ الجديد
        if (foundIndex === -1 && matchedReciter) {
            foundIndex = currentSurahIndex;
        }

        if (foundIndex !== -1) {
            playSurah(foundIndex);
            await updatePanelMessage();
            await interaction.reply({ 
                content: `▶️ جاري تشغيل سورة **${surahNames[foundIndex - 1]}** بصوت **${currentReciter.name}**`, 
                ephemeral: true 
            });
        } else {
            await interaction.reply({ content: `❌ لم يتم العثور على سورة باسم "${rawInput}"`, ephemeral: true });
        }
    }
});

client.login(process.env.BOT_TOKEN);
                                                               
