import esbuild from 'esbuild'
import { singleHtmlPlugin } from 'esbuild-single-html'

await esbuild.build({
  entryPoints: ['build/index.html'],
  outfile: 'public/index.html',
  bundle: true,
  minify: true,
  plugins: [singleHtmlPlugin()],
})
