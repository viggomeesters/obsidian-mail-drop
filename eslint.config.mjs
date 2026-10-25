import obsidianmd from 'eslint-plugin-obsidianmd';
export default [
 {ignores:['outputs/**','tests/**','scripts/**','node_modules/**']},
 ...obsidianmd.configs.recommended,
 {languageOptions:{parserOptions:{projectService:true}}},
];
