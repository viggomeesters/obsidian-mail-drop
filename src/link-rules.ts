/** Optional synchronous DOM contract; keeps native syntax when the provider is absent. */
export function delegateAttachmentLink(doc: Document, fileName: string, link: string): {link:string;handled:boolean} {
 const detail={version:1,fileName,link,handled:false};
 const EventClass=(doc.defaultView??window).CustomEvent;
 const event=new EventClass("attachment-link-rules:format-v1",{detail});
 doc.dispatchEvent(event);
 return {link:detail.handled&&typeof detail.link==="string"?detail.link:link,handled:detail.handled===true};
}

/** Prevent the rules plugin from also rewriting an importer's complete inserted block. */
export function claimAttachmentDrop(doc: Document, event: DragEvent): void {
 const EventClass=(doc.defaultView??window).CustomEvent;
 doc.dispatchEvent(new EventClass("attachment-link-rules:managed-drop-v1",{detail:{version:1,event}}));
}
