<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Song } from '../main';
let title = ref<HTMLElement | null>(null)

    onMounted(() => {
  title.value?.focus()
})

    

const props = defineProps<{
    song: Song
}>()


</script>


<style>
    input {
        width: em;
    }
    .title {
        width: 10em;
    }
    .artist {
        width: 6em;
    }
    .album {
        width: 6em;
    }
    .art {
        width: 6em;
    }
</style>

<template>
    <input ref="title" @input="$emit('title-change', song)" class="title" type="text" placeholder="title" v-model="song.title">
    <input @input="$emit('title-change', song)" class="artist" type="text" placeholder="artist" v-model="song.artist">
    <input class="album" type="text" placeholder="album" v-model="song.album">
    <input class="art" type="text" placeholder="cover art (URL)" v-model="song.coverArt">

</template>