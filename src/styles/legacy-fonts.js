// RX-8E — legacy typography boundary.
//
// V1 still uses the Bob-era Nunito/Baloo/Geist faces, but V2 has its own
// Barlow/Barlow Condensed identity. Keep these imports behind an explicit
// experience boundary so a normal V2 session never requests legacy font files.
import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-mono/500.css'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-600.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '@fontsource/baloo-2/latin-500.css'
import '@fontsource/baloo-2/latin-700.css'
import '@fontsource/baloo-2/latin-800.css'
