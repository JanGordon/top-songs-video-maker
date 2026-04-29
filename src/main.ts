import { reactive } from "vue";

export type Song = {
    title: string
    artist?: string
    album?: string
    notes?: string
    releaseYear?: string
    coverArt?: string
}

type State = {
    songList: Song[]
}

export const state: State = reactive({
    songList: [
        {title: "Afterglow"}
    ]
})