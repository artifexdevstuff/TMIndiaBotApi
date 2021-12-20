const { client } = require("../../tmio.js");
const cache = require('memory-cache');
const cb = require('../../cacheTimeoutCb.js')
// import chalk from 'chalk';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports.handle = (app) => {
    app.get("/tm2020/player/:id/matchmaking", async (req, res) => {
        const accId = req.params.id;

        const cacheEntry = cache.get(`tm2020:player:${accId}:matchmaking`)
        if (cacheEntry !== null) {
            const data = JSON.parse(cacheEntry);
            return res.send(data);
        }

        let player;
        try {
            player = await client.players.get(accId);
        } catch (e) {
            if (e === "Invalid account ID.") {
                res.status(400);
                return res.send({ err: "INVALID_ACCOUNT_ID", msg: e })
            }
        }

        const matchmaking = player.matchmaking();

        let page = 0;
        let historyRaw = await matchmaking.history(page);
        const history = [];

        while (historyRaw.length != 0) {
            historyRaw.forEach((mmResults) => {
                history.push(mmResults._data);
            });
            page += 1
            try {
                historyRaw = await matchmaking.history(page);
            } catch (e) {
                // If the Requests are over, we have to wait for a recharge
                console.log('Waiting for API Recharge...')
                await sleep(30000);
            }
        }

        const data = matchmaking._data;
        data.history = history;

        cache.put(`tm2020:player:${accId}:matchmaking`, JSON.stringify(data), 43200000, cb) // 1day
        res.send(data);

        console.log(`Remaining Requests: ${client.ratelimit.remaining}`)
    });
};

module.exports.registerdRoutes = ["/tm2020/player/:id/matchmaking"];
