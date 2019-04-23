let YtDlr = require("youtube-mp3-downloader")
let axios = require("axios")
let fs = require("fs")
let config = require("./config.json")
let dirRegex = /[\/\\:%\[\]"\.;|=,\*\?]/g


let output
try {
    fs.readFile("urls.txt", 'utf8', parseFile)
} catch (e) {
    console.log(e)
}

function parseFile(err, data) {
    if (err) throw err

    let videos = []
    let playlists = []

    data = data.split("\r\n")
    output = data.shift()
    output = output.split("->")
    output = output[output.length - 1].trim()
    try {
        if (!fs.existsSync(output))
            fs.mkdirSync(output)

        //fill arrays
        for (let line of data) {
            if (line) {
                if (line.includes("?list")) playlists.push(line.split("=")[1])
                else if (line.includes("channel")) console.log("channels WIP")
                else videos.push(line.split("=")[1].split("&")[0])
            }
        }

        console.log("output: " + output)
        console.log("playlists: " + playlists.length)
        console.log("videos: " + videos.length)

        if (playlists.length > 0) {
            downloadPlaylists(playlists)
        }
        let d = new Date()
        if (videos.length > 0) {
            if (!fs.existsSync(`${output}\\songs`))
                fs.mkdirSync(`${output}\\songs`)
            downloadVideos(videos, `songs\\${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`)
        }
    } catch (e) {
        throw e
    }
}


async function downloadVideos(list, playlistname) {
    try {
        let op = "unknown"
        if (playlistname) {
            op = output + "\\" + playlistname
            if (!fs.existsSync(op))
                fs.mkdirSync(op)
        }
        let YD = new YtDlr({
            "ffmpegPath": config.ffmpegPath,
            "outputPath": op,
            "youtubeVideoQuality": "highest",
            "queueParallelism": 2,
            "progressTimeout": 2000
        })
        for (let i of list) {
            await downloadVideo(YD, i, playlistname)
        }
    } catch (e) {
        throw e
    }
}

async function downloadPlaylists(list) {
    try {
        for (let pl of list) {
            await downloadPlaylist(pl)
        }
    } catch (e) {
        throw e
    }
}

async function downloadPlaylist(playlist) {
    try {
        let name = "generic"
        let data = await axios.get('https://www.googleapis.com/youtube/v3/playlists?id=' + playlist + '&key=' + config.access_token + '&part=snippet')

        if (data.data.items.length > 0) {
            name = data.data.items[0].snippet.title.replace(dirRegex, "_").replace(/ /g, "")

            let videos = await playlistInfo(playlist)
            console.log("[LIST][Start] " + name + " with " + videos.length + " items")

            await downloadVideos(videos, name)
            console.log("[LIST][Finish] " + name)
        }
    } catch (e) {
        throw e
    }
}

async function playlistInfo(id, list, token) {
    try {
        if (!list) list = []
        let get = 'https://www.googleapis.com/youtube/v3/playlistItems?playlistId=' + id + '&key=' + config.access_token + '&part=snippet&maxResults=50'
        if (token) get += "&pageToken=" + token

        let data = (await axios.get(get)).data

        let items = data.items
        for (let i of items) {
            if (i.snippet)
                list.push(i.snippet.resourceId.videoId)
        }
        if (data.nextPageToken)
            list.push(await playlistInfo(id, list, data.nextPageToken))

        return list
    } catch (e) {
        throw e
    }
}


async function downloadVideo(YD, url, playlistname) {
    return new Promise(async function (res, rej) {
        try {
            let data = await axios.get("https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" + url + "&key=" + config.access_token)

            let videoName = url
            let video = data.data.items[0]
            if (video) {
                videoName = video.snippet.title.replace(dirRegex, "_")
            }
            console.log("[SONG][" + playlistname + "] " + videoName)
            YD.download(url, videoName + ".mp3")

            YD.on("finished", (err, data) => {
                res()
            })
            YD.on("error", e => {
                console.log("[SONG][Error] " + videoName + "\n" + e)
                res()
            })
        } catch (e) {
            rej(e)
        }
    })
}
