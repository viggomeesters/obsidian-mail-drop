export type DropMode="images-only"|"custom"|"obsidian"|"link-rules";
export function isImageFile(name:string):boolean {
 return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(name);
}
export function linkedExtensions(value:string):Set<string> {
 return new Set(value.toLowerCase().split(/[,;\s]+/).map(value=>value.replace(/^\.+/,"")).filter(value=>/^[a-z0-9]+$/.test(value)));
}
export function wantsPlainLink(name:string,extensions:Set<string>,mode:DropMode="custom"):boolean {
 if(mode==="images-only")return !isImageFile(name);
 if(mode==="obsidian")return false;
 return extensions.has(name.slice(name.lastIndexOf(".")+1).toLowerCase());
}
export function droppedFileLink(name:string,linktext:string,extensions:Set<string>,mode:DropMode="custom"):string {
 if(mode==="images-only")return `${isImageFile(name)?"!":""}[[${linktext}]]`;
 // These are the attachment types Obsidian normally embeds. Documents otherwise use links.
 const embeds=/\.(pdf|avif|bmp|gif|jpe?g|png|svg|webp|mp3|wav|m4a|ogg|3gp|flac|mp4|webm|mov|mkv|ogv)$/i.test(name);
 return `${embeds&&!wantsPlainLink(name,extensions)?"!":""}[[${linktext}]]`;
}
