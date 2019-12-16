/**
 * Created by dehol on 2017-05-03.
 */
const Telegraf = require('telegraf');
const axios = require('axios');
const _ = require('lodash');

// Web Parts

const finalhandler = require('finalhandler')
const http = require('http')
const serveStatic = require('serve-static')

var port = process.env.PORT || 8080;

// Serve up public/ftp folder
const serve = serveStatic('public', {'index': ['index.html']})

// Create server
const server = http.createServer(function onRequest (req, res) {
    serve(req, res, finalhandler(req, res))
})

// Listen
server.listen(port)

// Telegram Bot Parts

const TelegramToken = process.env.TELEGRAM_TOKEN;
const AQICNToken = process.env.AQICN_TOKEN;

let compiledData = _.template('DATE: <%= date %>\nCITY: <%= city %>\nAQI: <%= aqi %> (<%= dominent %>, <%= aqiDesc %>)\n<%= url %>');
let compiledSimpleData = _.template('DATE: <%= date %>\nCITY: <%= city %>\nAQI: <%= aqi %> (<%= aqiDesc %>)\n<%= url %>');

function getAQILevelString(rating) {
    if (typeof rating == 'string') rating = parseInt(rating, 10)
    if (typeof rating != 'number') return 'None';

    if (rating < 51) return '🟢 Good';
    else if (rating < 101) return '🟡 Moderate';
    else if (rating < 151) return '🟠 Unhealthy for Sensitive Groups';
    else if (rating < 201) return '🔴 Unhealthy';
    else if (rating < 301) return '🟤 Very Unhealthy';
    else return '⚫️ Hazardous';
}

const app = new Telegraf(TelegramToken);

app.command('city', (ctx) => {
    if (!ctx.message.text) ctx.reply('');
    let cmdParts = _.split(ctx.message.text, ' ');

    if (cmdParts.length > 1) {
        let cityName = cmdParts[1];
        let compiledUrl = _.template('http://api.waqi.info/feed/<%= city %>/?token=<%= token %>');

        axios.get(compiledUrl({city: cityName, token: AQICNToken}))
            .then((response) => {
                let aqiData = response.data.data;
                let data = {
                    date: aqiData.time.s + ' ' + aqiData.time.tz,
                    city: aqiData.city.name,
                    aqi: aqiData.aqi,
                    aqiDesc: getAQILevelString(aqiData.aqi),
                    dominent: aqiData.dominentpol,
                    url: aqiData.city.url
                };
                ctx.reply(compiledData(data));
            })
            .catch((error) => {
                console.log(error);
                ctx.reply('안되네영 미아내오');
            })
    }
    else {
        ctx.reply('도시 이름을 입력해주세여');
    }
});

app.on('location', (ctx) => {
    if (ctx.message.location) {
        let location = ctx.message.location;
        let compiledUrl = _.template('http://api.waqi.info/feed/geo:<%= latitude %>;<%= longitude %>/?token=<%= token %>');

        axios.get(compiledUrl({latitude: location.latitude, longitude: location.longitude, token: AQICNToken}))
            .then((response) => {
                let aqiData = response.data.data;
                let data = {
                    date: aqiData.time.s + ' ' + aqiData.time.tz,
                    city: aqiData.city.name,
                    aqi: aqiData.aqi,
                    aqiDesc: getAQILevelString(aqiData.aqi),
                    dominent: aqiData.dominentpol,
                    url: aqiData.city.url
                };
                ctx.reply(compiledData(data));
            })
            .catch((error) => {
                console.log(error);
                ctx.reply('안되네영 미아내오');
            })
    }
    else {
        ctx.reply('뭔가 이상해여');
    }
});

app.on('inline_query', (ctx) => {
    if (ctx.inlineQuery && ctx.inlineQuery.query.length > 2) {
        let keyword = ctx.inlineQuery.query;
        let compiledUrl = _.template('http://api.waqi.info/search/?keyword=<%= keyword %>&token=<%= token %>');

        axios.get(compiledUrl({keyword: keyword, token: AQICNToken}))
            .then((response) => {
                    let aqiStations = response.data.data.map(o => {
                        let d = {
                            date: o.time.stime + ' ' + o.time.tz,
                            city: o.station.name,
                            aqi: o.aqi,
                            aqiDesc: getAQILevelString(o.aqi),
                            url: "https://aqicn.org/city/" + o.station.url
                        };
                        return {
                            type: 'article',
                            id: "" + o.uid,
                            title: o.station.name,
                            description: o.station.geo[0] + ', ' + o.station.geo[1],
                            input_message_content: {
                                message_text: compiledSimpleData(d)
                            }
                        };
                    });
                    ctx.answerInlineQuery(aqiStations, {cache_time: 30});
                }
            )
            .catch((error) => {
                console.log(error);
                ctx.answerInlineQuery([]);
            });
    }
    else {
        ctx.answerInlineQuery([]);
    }
});

app.startPolling();