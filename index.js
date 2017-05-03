/**
 * Created by dehol on 2017-05-03.
 */
const config = require('./config.json');
const Telegraf = require('telegraf');
const axios = require('axios');
const _ = require('lodash');

const CURRENT_ENV = config.currentEnv;
const app = new Telegraf(config.api[CURRENT_ENV].telegram.token);

let compiledData = _.template('DATE: <%= date %>\nCITY: <%= city %> / AQI: <%= aqi %> (<%= dominent %>)\n<%= url %>');
let compiledSimpleData = _.template('DATE: <%= date %>\nCITY: <%= city %> / AQI: <%= aqi %>\n<%= url %>');

app.command('city', (ctx) => {
    if (!ctx.message.text) ctx.reply('');
    let cmdParts = _.split(ctx.message.text, ' ');

    if (cmdParts.length > 1) {
        let cityName = cmdParts[1];
        let compiledUrl = _.template('http://api.waqi.info/feed/<%= city %>/?token=<%= token %>');

        axios.get(compiledUrl({city: cityName, token: config.api[CURRENT_ENV].aqicn.token}))
            .then((response) => {
                let aqiData = response.data.data;
                let data = {
                    date: aqiData.time.s + ' ' + aqiData.time.tz,
                    city: aqiData.city.name,
                    aqi: aqiData.aqi,
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

        axios.get(compiledUrl({latitude: location.latitude, longitude: location.longitude, token: config.api[CURRENT_ENV].aqicn.token}))
            .then((response) => {
                let aqiData = response.data.data;
                let data = {
                    date: aqiData.time.s + ' ' + aqiData.time.tz,
                    city: aqiData.city.name,
                    aqi: aqiData.aqi,
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

        axios.get(compiledUrl({keyword: keyword, token: config.api[CURRENT_ENV].aqicn.token}))
            .then((response) => {
                    let aqiStations = response.data.data.map(o => {
                        let d = {
                            date: o.time.stime + ' ' + o.time.tz,
                            city: o.station.name,
                            aqi: o.aqi,
                            url: "https://aqicn.org/city/" + o.station.url
                        };
                        return {
                            type: 'article',
                            id: "" + o.uid,
                            title: o.station.name,
                            input_message_content: {
                                message_text: compiledSimpleData(d)
                            }
                        };
                    });
                    ctx.answerInlineQuery(aqiStations);
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