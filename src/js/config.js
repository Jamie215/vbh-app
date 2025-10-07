// Supabase configuration
const SUPABASE_URL = window.ENV?.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || '';

// Check if keys are configured
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing API keys. Please configure environment variables.');
}

// Playlist structure
const PLAYLISTS = [
    {
        id: 'beginner-0-3',
        title: 'Beginner 0-3',
        description: 'Light load workout for starting',
        thumbnail: 'https://img.youtube.com/vi/HQFwKn5zzN4/maxresdefault.jpg',
        videos: [
            {
                id: 'HQFwKn5zzN4',
                title: 'Squats',
                sets: 3,
                reps: 8,
                equipment: "Chair",
                thumbnail: 'https://img.youtube.com/vi/HQFwKn5zzN4/maxresdefault.jpg',
                order: 1
            },
            {
                id: 'KkJWk44cnbU',
                title: 'Cloth Slide',
                sets: 3,
                reps: 8,
                equipment: "Cloth",
                thumbnail: 'https://img.youtube.com/vi/KkJWk44cnbU/maxresdefault.jpg',
                order: 2
            }
        ]
    },
    {
        id: 'intermediate-0-3',
        title: 'Intermediate 0-3',
        description: 'Intermediate load workout for more challenge',
        thumbnail: 'https://img.youtube.com/vi/KkJWk44cnbU/maxresdefault.jpg',
        videos: [
            {
                id: 'KkJWk44cnbU',
                title: 'Cloth Slide',
                sets: 3,
                reps: 8,
                equipment: "Cloth",
                thumbnail: 'https://img.youtube.com/vi/Sc7w24mG8LE/maxresdefault.jpg',
                order: 1
            },
            {
                id: 'HQFwKn5zzN4',
                title: 'Squat',
                sets: 3,
                reps: 8,
                equipment: "Chair",
                thumbnail: 'https://img.youtube.com/vi/HQFwKn5zzN4/maxresdefault.jpg',
                order: 2
            }
        ]
    },

]

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);