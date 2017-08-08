const got = require('got');
const leven = require('leven');

const apiToken = global.config.curseforgeAPIToken;

const opts = {
    headers: {
        'X-Api-Token': apiToken
    }
};

exports.run = async function (bot, msg, args) {
    if (!apiToken) {
        throw 'Please get a CurseForge API token at https://www.curseforge.com/account/api-tokens, put it in your config file, and restart the bot.';
    }

    if (args.length < 1) {
        return usage(bot, msg);
    }

    const sub = args[0].toLowerCase();
    args = args.slice(1);

    if (sub === 'search') {
        if (args.length < 1) {
            throw 'You must provide something to search for!';
        }

        const query = args.join('-').toLowerCase();
        const data = await search(query);
        msg.channel.send({
            embed: global.factory.embed({ fields: getResults(data) })
                .setTitle(`Search results for __\`${query}\`__`)
        });

    } else if (sub === 'info') {
        if (args.length < 1) {
            return usage(bot, msg);
        }

        const versions = await getVersions(args);
        const fields = versions.map(v => {
            return {
                name: v.name,
                value: `
**Release type:** ${v.releaseType}
**Game version:** ${v.gameVersion}
**File name:** ${v.fileName}
:inbox_tray: [Download](${v.downloadUrl})`
            };
        });

        msg.channel.send({
            embed: global.factory.embed({ fields })
                .setDescription(`Click [here](https://dev.bukkit.org/projects/${args.join('-')}/) to see the project page.`)
        });

    } else if (sub === 'download') {
        if (args.length < 1) {
            return usage(bot, msg);
        }

        const versions = await getVersions(args);
        const version = versions[0];
        download(version.downloadUrl, version.fileName, msg.author);
        msg.channel.send(':inbox_tray: Downloading plugin, expect a PM shortly with the file!');

    } else {
        usage(bot, msg);
    }
};

function getResults(data) {
    return data
        .map(p => {
            return {
                name: p.name,
                value: `
**Slug:** \`${p.slug}\`
**ID:** \`${p.id}\`
**Stage:** \`${p.stage}\``
            };
        })
        .slice(0, 5);
}

async function search(query) {
    const res = await got(`https://api.curseforge.com/servermods/projects?search=${query}`, opts);
    const data = JSON.parse(res.body);

    if (data.length < 1) {
        throw 'No plugins found with that ID!';
    }

    return data.sort((a, b) => leven(query, a.slug) - leven(query, b.slug));
}

async function getVersions(args) {
    let id = args[0];
    if (isNaN(id)) {
        const query = args.join('-').toLowerCase();
        const results = await search(query);
        id = results[0].id;
    }

    const res = await got(`https://api.curseforge.com/servermods/files?projectids=${id}`);
    const data = JSON.parse(res.body);

    if (data.length < 1) {
        throw 'No plugins found with that ID!';
    }

    return data.splice(data.length - 5).reverse();
}

async function download(url, name, user) {
    const result = await got(url, Object.assign(opts, { encoding: null }));

    if (result.body.length > 8 * 1024 * 1024) {
        user.send(`:no_entry_sign: The file was too big to send! Click the following link to download it yourself:\n${url}`);
    } else {
        user.send({
            file: {
                attachment: result.body,
                name: name
            }
        });
    }
}

function usage(bot, msg) {
    msg.channel.send({
        embed: global.factory.embed()
            .setTitle(`Usage for \`${global.config.prefix}plugin\`:`)
            .addField('search', `\`${global.config.prefix}plugin search <name>\``)
            .addField('info', `\`${global.config.prefix}plugin info <slug|id>\``)
            .addField('download', `\`${global.config.prefix}plugin download <projectid>\``)
    });
}

exports.info = {
    name: 'plugin',
    usage: 'plugin <info|search|download> <plugin>',
    description: 'Various plugin-related commands'
};