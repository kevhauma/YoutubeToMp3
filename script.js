let YtDlr = require("youtube-mp3-downloader")
let axios = require("axios")
let fs = require("fs")
let config = require("./config.json")
let dirRegex = /[\/\\:%\[\]"\.;|=,\*\?]/g

let videos = []
let playlists = []
let output

try {
    fs.readFile("urls.txt", 'utf8', function (err, data) {
        if (err) throw err
        data = data.split("\r\n")
        output = data[0].split("->")
        output = output[output.length - 1].trim()
        if (!fs.existsSync(output))
            fs.mkdirSync(output)

        for (let i = 1; i < data.length; i++) {
            if (data[i]) {
                if (data[i].includes("?list")) playlists.push(data[i].split("=")[1])
                else if (data[i].includes("channel")) console.log("channels WIP")
                else videos.push(data[i].split("=")[1].split("&")[0])
            }
        }
        console.log("playlists: " + playlists.length)
        console.log("videos: " + videos.length)
        if (playlists.length > 0) {
            let next = playlists.shift()
            downloadPlaylists(playlists, next)
                .catch(err => console.log(err))
        }
        if (videos.length > 0) {
            let next = videos.shift()
            downloadVideos(videos, next, "songs")
                .catch(err => console.log(err))
        }
    })

    function downloadVideos(list, url, playlistname) {
        return new Promise((resolve, reject) => {
            let op = output
            if (playlistname) {
                op = output + "/" + playlistname
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

            axios.get("https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" + url + "&key=" + config.access_token)
                .then((data) => {
                    let videoName = url
                    if (data.data.items[0]) {
                        videoName = data.data.items[0].snippet.title.replace(dirRegex, "_")
                    }
                    console.log("[SONG][" + playlistname + "] " + videoName);
                    YD.download(url, videoName + ".mp3")
                    YD.on("finished", (err, data) => {
                        return nextVid()
                    })
                    YD.on("error", (err) => {
                        return nextVid()
                    })
                })
                .catch(err => {
                    nextVid()
                })

            async function nextVid() {
                if (list.length > 0) {
                    let next = list.shift()
                    await downloadVideos(list, next, playlistname)
                }
                return resolve()
            }
        })

    }


    function downloadPlaylists(pl, plURL) {
        return new Promise((resolve, reject) => {
            let urls = []

            let name = "generic"
            axios.get('https://www.googleapis.com/youtube/v3/playlists?id=' + plURL + '&key=' + config.access_token + '&part=snippet')
                .then(data => {
                    if (data.data.items.length > 0)
                        name = data.data.items[0].snippet.title.replace(dirRegex, "_").replace(/ /g, "")
                    else return nextPlaylist()
                }).then(() => {
                    return playlistInfo(plURL, urls)
                }).then((data) => {
                    console.log("[LIST][S] " + name + " with " + data.length + " items")
                    let next = data.shift()
                    return downloadVideos(data, next, name)
                })
                .then(() => {
                    console.log("[LIST][F] " + name)
                    return nextPlayList()
                })
                .catch(err => {
                    return nextPlaylist()
                })

            async function nextPlayList() {
                if (pl.length > 0) {
                    let next = pl.shift()
                    await downloadPlaylists(pl, next)
                }
                return resolve()
            }
        })
    }


    function playlistInfo(id, list, token) {
        return new Promise((resolve, reject) => {
            let get = 'https://www.googleapis.com/youtube/v3/playlistItems?playlistId=' + id + '&key=' + config.access_token + '&part=snippet&maxResults=50'
            if (token) get += "&pageToken=" + token

            axios.get(get)
                .then(data => {
                    let items = data.data.items
                    for (let j = 0; j < items.length; j++) {
                        if (items[j].snippet)
                            list.push(items[j].snippet.resourceId.videoId)
                    }
                    if (data.data.nextPageToken)
                        return playlistInfo(id, list, data.data.nextPageToken)
                    else resolve(list)
                })
                .then((list) => resolve(list))
                .catch(err => reject(err))
        })
    }

} catch (err) {
    console.log(error)
}
