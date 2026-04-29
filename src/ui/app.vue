<script setup lang="ts">
import { isReactive, ref } from 'vue';
import { Song, state } from '../main';
import { MusicBrainzRecording, MusicBrainzRecordingResponse, Suggestion } from '../types';
import SongCard from './songCard.vue';
import { exportVideo, exportVideoWithAudio } from '../render';

var currentSuggestedSong = ref<{for: Song, suggestion: Suggestion} | null>(null)

var currentTimeout = 0;

function handleTitleChange(song: Song) {
    clearTimeout(currentTimeout)
    currentTimeout = setTimeout(()=>updateSuggestions(song), 500)
}

async function updateSuggestions(song: Song) {
    let titleQuery = ""
    for (let i of song.title.split(" ")) {
        titleQuery+=i+"~ "
    }
    console.log(titleQuery)
    let res = await fetch(`https://musicbrainz.org/ws/2/recording/?query=recording:"${song.title}"~2${ (song.artist == undefined) ? "" : ` AND artist:"${song.artist}"~1`} AND primarytype:album  AND NOT secondarytype:live&fmt=json&limit=5`)
    let j = await res.json() as MusicBrainzRecordingResponse
    console.log(j.recordings)
    let releaseGroupPopularity = new Map<string, number>()

    for (let r of j.recordings) {
        if (r.releases) {
            for (let i of r.releases) {
                let rgID = i['release-group']?.id
                if (rgID) {
                    let p = releaseGroupPopularity.get(rgID) ?? 0
                    releaseGroupPopularity.set(rgID, p + 1)
                }
                console.log("relase: ", i.id, i.title, i['release-group']?.id)
            }
        }
    }

    let mostPopular = ""
    let howPopular = 0
    for (let [id, count] of releaseGroupPopularity.entries()) {
        if (count > howPopular) {
            mostPopular = id
            howPopular = count
        }
    }


    // find a recording with that relase group id
    let recording: MusicBrainzRecording = j.recordings[0]
    let albumName: string = ""
    out:
    for (let r of j.recordings) {
        if (r.releases) {

            for (let i of r.releases) {
                if (i['release-group']) {
                    if (i['release-group'].id == mostPopular) {
                        albumName = i.title
                        recording = r
                        break out
                    }

                }
            }
        }
    }

    currentSuggestedSong.value = {for: song, suggestion: {
        title: recording.title,
        artist: recording['artist-credit']?.[0].name,
        album: albumName,
        coverArt: `https://coverartarchive.org/release-group/${mostPopular}/front-250`
    }}

        
    

}


function acceptSuggestion() {
    if (currentSuggestedSong.value?.for) {
        for (let [k,v] of Object.entries(currentSuggestedSong.value?.suggestion)) {
            //@ts-ignore
            currentSuggestedSong.value.for[k] = v
        }
    }
    addSong()
    
    
}

function addSong() {
    state.songList.push({title: ""})

}

let viewport = ref<HTMLCanvasElement | null>(null)
    function handleRender() {
        exportVideoWithAudio()
        // render(viewport.value!)
    }

</script>

<template>

    <div style="height: 10em; position: absolute; top: 0;">
        <div v-if="currentSuggestedSong?.suggestion" style="display: flex; align-items: center; height: 100%;">

        <div style="height: 100%; display: flex; flex-direction: column;">
            <img :src="currentSuggestedSong.suggestion.coverArt" alt="" style="height: calc(100%  - 2em);">
            {{ currentSuggestedSong.suggestion.title ?? "" }}
            By {{ currentSuggestedSong.suggestion.artist }}
        </div>
        
        <button @click="acceptSuggestion">Accept</button>
    </div>
    </div>
    

    <ol style="margin-top: 10em;">
        <li v-for="song in state.songList">
            <SongCard @title-change="handleTitleChange" :song="song"></SongCard>
        </li>
    </ol>
    <button @click="addSong">Add Song</button>


    <button @click="handleRender">Render</button>

    <canvas ref="viewport"></canvas>
</template>