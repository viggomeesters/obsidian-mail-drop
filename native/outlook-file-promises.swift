import AppKit
import CoreGraphics
import Darwin

struct Target: Codable {
 let id: String
 let path: String
 let x: Double
 let y: Double
 let width: Double
 let height: Double
 var cocoaFrame: NSRect {
  let top = NSScreen.screens.first?.frame.maxY ?? 0
  return NSRect(x: x, y: top - y - height, width: width, height: height)
 }
}
func emit(_ payload: [String: Any]) {
 guard let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]) else { return }
 FileHandle.standardOutput.write(data + Data([10]))
}
// Inspect only declared pasteboard types; never mailbox data or the general clipboard.
func promiseContentTypes(_ board: NSPasteboard) -> [String] {
 let content = NSPasteboard.PasteboardType("com.apple.pasteboard.promised-file-content-type")
 let legacy = NSPasteboard.PasteboardType("Apple files promise pasteboard type")
 var values: [String] = []
 for item in board.pasteboardItems ?? [] {
  if let type = item.string(forType: content), !type.isEmpty { values.append(type) }
 }
 if let types = board.propertyList(forType: legacy) as? [String] { values.append(contentsOf: types) }
 return Array(Set(values)).sorted()
}
func mailPromiseSource(_ types: [NSPasteboard.PasteboardType], contentTypes: [String] = []) -> String? {
 let names = types.map { $0.rawValue }
 guard names.contains(where: { $0.lowercased().contains("promise") }) else { return nil }
 // Preserve the previously accepted Outlook contract.
 if names.contains("com.microsoft.kOlxMessagePasteboardType") || names.contains("WMOutlookInternalFilePromisePboardType") { return "outlook" }
 let mailTypes = Set(["com.apple.mail.email", "public.email-message", "eml", "message/rfc822"])
 let declaredMail = !contentTypes.isEmpty && contentTypes.allSatisfy { mailTypes.contains($0.lowercased()) }
 // A declared image/PDF/EMLX is not a mail drag, even if Mail owns the pasteboard.
 if !contentTypes.isEmpty && !declaredMail { return nil }
 if names.contains("com.apple.mail.PasteboardTypeMessageTransfer") ||
    (names.contains("com.apple.mail.PasteboardTypeMessageContents") && declaredMail) { return "apple-mail" }
 if declaredMail || names.contains("com.apple.mail.email") { return "eml" }
 return nil
}
func mailPromiseSource(_ board: NSPasteboard) -> String? {
 return mailPromiseSource(board.types ?? [], contentTypes: promiseContentTypes(board))
}
// Apple Mail can write an EML without completing AppKit's legacy promise callback.
// Only accept materialized files after their handles are closed, their identity/size/mtime
// are stable, and their MIME envelope is complete. No arbitrary sleep means success.
struct MailFileStamp: Equatable {
 let size: UInt64
 let modified: Date
 let inode: UInt64
}
func mailFileStamp(_ url: URL) -> MailFileStamp? {
 guard let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
       attrs[.type] as? FileAttributeType == .typeRegular,
       let size = attrs[.size] as? NSNumber, size.uint64Value > 0,
       let modified = attrs[.modificationDate] as? Date,
       let inode = attrs[.systemFileNumber] as? NSNumber else { return nil }
 return MailFileStamp(size: size.uint64Value, modified: modified, inode: inode.uint64Value)
}
func mailFileIsClosed(_ url: URL) -> Bool {
 var pids = [Int32](repeating: 0, count: 4)
 let count = url.path.withCString { path in
  pids.withUnsafeMutableBytes { buffer in proc_listpidspath(1, 0, path, 2, buffer.baseAddress, Int32(buffer.count)) }
 }
 // Negative means inspection failed, not that the writer is finished.
 return count == 0
}
func hasCompleteMailEnvelope(_ url: URL, size: UInt64) -> Bool {
 guard let file = try? FileHandle(forReadingFrom: url) else { return false }
 defer { try? file.close() }
 guard let data = try? file.read(upToCount: 65536), !data.isEmpty else { return false }
 let headerText = String(decoding: data, as: UTF8.self)
 guard let separator = headerText.range(of: "\r\n\r\n") ?? headerText.range(of: "\n\n") else { return false }
 let header = String(headerText[..<separator.lowerBound]).replacingOccurrences(of: "\r?\n[ \t]+", with: " ", options: .regularExpression)
 guard header.range(of: "(?im)^(from|subject|date):", options: .regularExpression) != nil else { return false }
 guard header.range(of: "(?im)^content-type:[ \t]*multipart/", options: .regularExpression) != nil else { return true }
 let pattern = "(?im)^content-type:[^\n]*?boundary[ \t]*=[ \t]*(?:\"([^\"]+)\"|([^; \t\r\n]+))"
 guard let regex = try? NSRegularExpression(pattern: pattern), let match = regex.firstMatch(in: header, range: NSRange(header.startIndex..., in: header)) else { return false }
 let capture = match.range(at: 1).location != NSNotFound ? match.range(at: 1) : match.range(at: 2)
 guard let range = Range(capture, in: header) else { return false }
 let boundary = String(header[range])
 guard !boundary.isEmpty, boundary.utf8.count < 1000 else { return false }
 do { try file.seek(toOffset: size > 65536 ? size - 65536 : 0) } catch { return false }
 guard let tail = try? file.readToEnd() else { return false }
 return String(decoding: tail, as: UTF8.self).range(of: "(?m)(?:^|\r?\n)--" + NSRegularExpression.escapedPattern(for: boundary) + "--[ \t]*(?:\r?\n|$)", options: .regularExpression) != nil
}
final class MaterializedMailCheck {
 var snapshots: [String: (stamp: MailFileStamp, since: Date)] = [:]
 func ready(in folder: URL, expected: Int, now: Date = Date(), isClosed: (URL) -> Bool = mailFileIsClosed) -> [String]? {
  guard expected > 0, let enumerator = FileManager.default.enumerator(at: folder, includingPropertiesForKeys: nil, options: [.skipsPackageDescendants]) else { return nil }
  var candidates: [URL] = []
  for case let url as URL in enumerator where url.pathExtension.lowercased() == "eml" {
   guard url.resolvingSymlinksInPath().path.hasPrefix(folder.resolvingSymlinksInPath().path + "/"), mailFileStamp(url) != nil else { return nil }
   candidates.append(url)
  }
  guard candidates.count == expected else { return nil }
  var complete = true
  for url in candidates {
   guard let stamp = mailFileStamp(url) else { return nil }
   let previous = snapshots[url.path]
   if previous?.stamp != stamp { snapshots[url.path] = (stamp, now); complete = false; continue }
   guard let previous = previous, now.timeIntervalSince(previous.since) >= 1.0 else { complete = false; continue }
   guard isClosed(url), hasCompleteMailEnvelope(url, size: stamp.size),
         mailFileStamp(url) == stamp, isClosed(url) else {
    snapshots[url.path] = (stamp, now); complete = false; continue
   }
  }
  return complete ? candidates.map { $0.resolvingSymlinksInPath().path }.sorted() : nil
 }
}
final class DropPanel: NSPanel {
 override var canBecomeKey: Bool { false }
 override var canBecomeMain: Bool { false }
}
final class PromiseView: NSView {
 weak var coordinator: Coordinator?
 var target: Target?
 override init(frame frameRect: NSRect) {
  super.init(frame: frameRect)
  registerForDraggedTypes(NSFilePromiseReceiver.readableDraggedTypes.map { NSPasteboard.PasteboardType($0) })
  wantsLayer = true
  layer?.borderWidth = 2
  layer?.borderColor = NSColor.controlAccentColor.withAlphaComponent(0.65).cgColor
  layer?.cornerRadius = 5
 }
 required init?(coder: NSCoder) { fatalError("Not used") }
 override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
  guard target != nil, mailPromiseSource(sender.draggingPasteboard) != nil else { return [] }
  return .copy
 }
 override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation { draggingEntered(sender) }
 override func prepareForDragOperation(_ sender: NSDraggingInfo) -> Bool { !draggingEntered(sender).isEmpty }
 override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
  guard let target = target, let coordinator = coordinator else { return false }
  coordinator.finishingDrag = true
  let accepted = coordinator.receive(sender.draggingPasteboard, target: target)
  if !accepted { coordinator.finishingDrag = false }
  return accepted
 }
 override func concludeDragOperation(_ sender: NSDraggingInfo?) {
  coordinator?.finishingDrag = false
  coordinator?.panel.orderOut(nil)
  emit(["event": "drag-concluded"])
 }
 override func draggingEnded(_ sender: NSDraggingInfo) {
  coordinator?.finishingDrag = false
  coordinator?.panel.orderOut(nil)
 }
}
final class Coordinator {
 let panel: DropPanel
 let dropView: PromiseView
 var targets: [Target] = []
 var lastChange: Int
 var activeChange: Int?
 var finishingDrag = false
 var releaseTime: Date?
 var timer: Timer?
 var materializationTimers: [UUID: Timer] = [:]
 var onDrop: (([String: Any]) -> Void)?
 var dropSources: [UUID: String] = [:]
 var retainedPromises: [UUID: [NSFilePromiseReceiver]] = [:]
 var retainedQueues: [UUID: [OperationQueue]] = [:]
 var pendingDrops: [UUID: (remaining: Int, paths: [String], errors: [String])] = [:]
 let pasteboard = NSPasteboard(name: .drag)
 init() {
  lastChange = pasteboard.changeCount
  panel = DropPanel(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
  dropView = PromiseView(frame: .zero)
  dropView.coordinator = self
  panel.contentView = dropView
  panel.isOpaque = false
  // Tiny alpha on the background keeps the drop surface hit-testable, without obscuring the note.
  panel.backgroundColor = NSColor.white.withAlphaComponent(0.01)
  panel.hasShadow = false
  panel.level = .floating
  panel.hidesOnDeactivate = false
  panel.becomesKeyOnlyIfNeeded = true
  panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
  panel.isReleasedWhenClosed = false
 }
 func start() {
  timer = Timer(timeInterval: 0.08, repeats: true) { [weak self] _ in self?.poll() }
  RunLoop.main.add(timer!, forMode: .common)
  emit(["event": "ready", "protocol": 1])
 }
 func obsidianIsVisible(at point: NSPoint) -> Bool {
  let top = NSScreen.screens.first?.frame.maxY ?? 0
  let quartz = CGPoint(x: point.x, y: top - point.y)
  guard let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { return false }
  for window in windows {
   guard let layer = window[kCGWindowLayer as String] as? Int, layer >= 0, layer <= 3,
         (window[kCGWindowOwnerPID as String] as? Int32) != ProcessInfo.processInfo.processIdentifier,
         let bounds = window[kCGWindowBounds as String] as? [String: Any],
         let rect = CGRect(dictionaryRepresentation: bounds as CFDictionary), rect.contains(quartz),
         (window[kCGWindowAlpha as String] as? Double ?? 1) > 0 else { continue }
   return (window[kCGWindowOwnerName as String] as? String) == "Obsidian"
  }
  return false
 }
 func poll() {
  if finishingDrag { return }
  let down = NSEvent.pressedMouseButtons & 1 != 0
  let change = pasteboard.changeCount
  if change != lastChange {
   lastChange = change
   let source = mailPromiseSource(pasteboard)
   activeChange = down && source != nil ? change : nil
   emit(["event": "pasteboard-change", "change": change, "mouseDown": down, "source": source ?? "other", "types": (pasteboard.types ?? []).map { String($0.rawValue.prefix(200)) }, "contentTypes": promiseContentTypes(pasteboard)])
   if activeChange != nil { emit(["event": "drag-start", "change": change, "source": source!]) }
  }
  guard activeChange != nil else { panel.orderOut(nil); return }
  guard down else {
   // Let AppKit deliver mouse-up / performDragOperation before removing the receiver.
   if releaseTime == nil { releaseTime = Date() }
   if Date().timeIntervalSince(releaseTime!) > 0.2 { panel.orderOut(nil); activeChange = nil; releaseTime = nil }
   return
  }
  releaseTime = nil
  let mouse = NSEvent.mouseLocation
  guard let target = targets.first(where: { $0.cocoaFrame.contains(mouse) }), obsidianIsVisible(at: mouse) else {
   panel.orderOut(nil); return
  }
  dropView.target = target
  panel.setFrame(target.cocoaFrame, display: true)
  if !panel.isVisible { panel.orderFrontRegardless(); emit(["event": "target", "target": target.id, "path": target.path]) }
 }
 func receive(_ board: NSPasteboard, target: Target) -> Bool {
  guard let source = mailPromiseSource(board), let promises = board.readObjects(forClasses: [NSFilePromiseReceiver.self], options: nil) as? [NSFilePromiseReceiver], !promises.isEmpty else {
   emit(["event": "error", "message": "The mail app did not provide a receivable email. Try dragging it again."])
   return false
  }
  let id = UUID()
  let destination = FileManager.default.temporaryDirectory.appendingPathComponent("obsidian-outlook-" + id.uuidString, isDirectory: true)
  do { try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true) }
  catch { emit(["event": "error", "message": "Could not create temporary email storage: \(error.localizedDescription)"]); return false }
  let expected = promises.reduce(0) { $0 + max($1.fileNames.count, $1.fileTypes.count, 1) }
  pendingDrops[id] = (expected, [], [])
  dropSources[id] = source
  retainedPromises[id] = promises
  retainedQueues[id] = []
  activeChange = nil
  let when = ISO8601DateFormatter().string(from: Date())
  emit(["event": "receiving", "target": target.id, "path": target.path, "source": source, "directory": destination.path, "promises": promises.count, "expectedFiles": expected])
  for promise in promises {
   let queue = OperationQueue(); queue.maxConcurrentOperationCount = 1
   retainedQueues[id]?.append(queue)
   let itemFolder = destination.appendingPathComponent(UUID().uuidString, isDirectory: true)
   do { try FileManager.default.createDirectory(at: itemFolder, withIntermediateDirectories: true) }
   catch {
    if var state = pendingDrops[id] {
     state.errors.append("Could not create the temporary email folder: \(error.localizedDescription)")
     state.remaining -= max(promise.fileNames.count, promise.fileTypes.count, 1)
     pendingDrops[id] = state
     if state.remaining <= 0 { finish(id, target: target, when: when, destination: destination) }
    }
    continue
   }
   // Let AppKit conclude the drag before asking a legacy provider to complete it.
   DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
    emit(["event": "promise-start", "source": source])
    promise.receivePromisedFiles(atDestination: itemFolder, options: [:], operationQueue: queue) { [weak self] url, error in
    DispatchQueue.main.async {
     guard let self = self, var state = self.pendingDrops[id] else { return }
     emit(["event": "promise-callback", "source": source, "success": error == nil])
     if let error = error { state.errors.append(error.localizedDescription) }
     else { state.paths.append(url.path) }
     state.remaining -= 1
     self.pendingDrops[id] = state
     if state.remaining <= 0 { self.finish(id, target: target, when: when, destination: destination) }
    }
   }
   }
  }
  if source == "apple-mail", pendingDrops[id] != nil {
   watchMaterialized(id, target: target, when: when, destination: destination, expected: expected)
  }
  DispatchQueue.main.asyncAfter(deadline: .now() + 45) { [weak self] in
   guard let self = self, var state = self.pendingDrops[id] else { return }
   state.errors.append("The mail app did not provide all emails. Drag the missing email again.")
   self.pendingDrops[id] = state
   self.finish(id, target: target, when: when, destination: destination)
  }
  return true
 }
 func watchMaterialized(_ id: UUID, target: Target, when: String, destination: URL, expected: Int) {
   let source = "apple-mail"
   let check = MaterializedMailCheck()
   let timer = Timer(timeInterval: 0.25, repeats: true) { [weak self] _ in
    guard let self = self, var state = self.pendingDrops[id],
          let paths = check.ready(in: destination, expected: expected) else { return }
    state.paths = paths; state.remaining = 0; state.errors = []
    self.pendingDrops[id] = state
    emit(["event": "materialized-mail-ready", "source": source, "files": paths.count])
    self.finish(id, target: target, when: when, destination: destination, completion: "materialized-files")
   }
   materializationTimers[id] = timer
   RunLoop.main.add(timer, forMode: .common)
 }
 func finish(_ id: UUID, target: Target, when: String, destination: URL, completion: String = "callback") {
  guard let state = pendingDrops.removeValue(forKey: id) else { return }
  materializationTimers.removeValue(forKey: id)?.invalidate()
  let source = dropSources.removeValue(forKey: id) ?? "unknown"
  retainedPromises.removeValue(forKey: id)
  retainedQueues.removeValue(forKey: id)
  let payload: [String: Any] = ["event": "drop", "source": source, "completion": completion, "target": target.id, "path": target.path, "when": when, "files": state.paths, "errors": state.errors, "directory": destination.path]
  emit(payload)
  onDrop?(payload)
 }
}

if CommandLine.arguments.contains("--self-test") {
 let outlook = "com.microsoft.kOlxMessagePasteboardType", transfer = "com.apple.mail.PasteboardTypeMessageTransfer"
 let modern = "com.apple.NSFilePromiseItemMetaData", legacy = "Apple files promise pasteboard type"
 let cases: [(String, [String], [String], String?)] = [
  ("outlook-modern", [outlook, modern], [], "outlook"),
  ("outlook-legacy", ["WMOutlookInternalFilePromisePboardType", legacy], [], "outlook"),
  ("apple-modern", [transfer, modern], ["com.apple.mail.email"], "apple-mail"),
  ("apple-legacy", [transfer, legacy], ["eml", "eml"], "apple-mail"),
  ("apple-transfer-only-declaration", [transfer, modern], [], "apple-mail"),
  ("apple-contents-eml", ["com.apple.mail.PasteboardTypeMessageContents", modern], ["com.apple.mail.email"], "apple-mail"),
  ("declared-eml", [modern], ["com.apple.mail.email"], "eml"),
  ("finder-file", ["public.file-url"], [], nil),
  ("outlook-without-promise", [outlook], [], nil),
  ("apple-without-promise", [transfer], [], nil),
  ("unrelated-promise", [modern], ["public.pdf"], nil),
  ("unknown-promise", [modern], [], nil),
  ("mail-inline-image", ["com.apple.mail.PasteboardTypeMessageContents", modern], ["public.png"], nil),
  ("transfer-image", [transfer, legacy], ["png"], nil),
  ("mail-content-without-file-type", ["com.apple.mail.PasteboardTypeMessageContents", modern], [], nil),
  ("internal-emlx", [transfer, modern], ["com.apple.mail.emlx"], nil),
  ("mixed-mail-image", [transfer, modern], ["eml", "public.jpeg"], nil)
 ]
 let results = cases.map { name, types, content, expected in
  return ["name": name, "passed": mailPromiseSource(types.map { .init($0) }, contentTypes: content) == expected] as [String: Any]
 }
 let passed = results.allSatisfy { $0["passed"] as? Bool == true }
 emit(["event": "self-test", "passed": passed, "cases": results])
 exit(passed ? 0 : 1)
}
if CommandLine.arguments.contains("--pasteboard-self-test") {
let scenarios: [(String, [String], Bool)] = [("modern-email", ["com.apple.mail.email"], false), ("legacy-multiple-eml", ["eml", "eml"], true), ("legacy-inline-image", ["png"], true)]
var result: [[String: Any]] = []
for (name, content, legacy) in scenarios {
 let board = NSPasteboard.withUniqueName()
 let item = NSPasteboardItem()
 item.setString("fixture", forType: .init("com.apple.mail.PasteboardTypeMessageTransfer"))
 if legacy {
  board.declareTypes([.init("com.apple.mail.PasteboardTypeMessageTransfer"),.init("Apple files promise pasteboard type")], owner:nil)
  board.setString("fixture", forType:.init("com.apple.mail.PasteboardTypeMessageTransfer"))
  board.setPropertyList(content,forType:.init("Apple files promise pasteboard type"))
 }
 else {
  item.setString(content[0], forType: .init("com.apple.pasteboard.promised-file-content-type"))
  item.setData(Data(), forType: .init("com.apple.NSFilePromiseItemMetaData"))
 }
 if !legacy { board.writeObjects([item]) }
 let actual = mailPromiseSource(board)
 let passed = legacy && content == ["png"] ? actual == nil : actual == "apple-mail"
 result.append(["name": name, "passed": passed, "types": (board.types ?? []).map { $0.rawValue }, "declared": promiseContentTypes(board)])
 board.releaseGlobally()
}
emit(["passed": result.allSatisfy { $0["passed"] as? Bool == true }, "cases": result])

exit(result.allSatisfy { $0["passed"] as? Bool == true } ? 0 : 1)
}
if CommandLine.arguments.contains("--materialization-self-test") {
 let folder = FileManager.default.temporaryDirectory.appendingPathComponent("mail-readiness-test-" + UUID().uuidString, isDirectory: true)
 try! FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
 defer { try? FileManager.default.removeItem(at: folder) }
 let url = folder.appendingPathComponent("complete.eml")
 let text = "From: test@example.invalid\r\nContent-Type: multipart/mixed; boundary=\"test-boundary\"\r\n\r\n--test-boundary\r\nContent-Type: text/plain\r\n\r\nBody\r\n--test-boundary--\r\n"
 let now = Date()
 var checks: [[String: Any]] = []
 func record(_ name: String, _ passed: Bool) { checks.append(["name": name, "passed": passed]) }
 let check = MaterializedMailCheck()
 var closed = true
 record("missing-file", check.ready(in: folder, expected: 1, now: now, isClosed: { _ in closed }) == nil)
 try! Data(text.utf8).write(to: url)
 record("requires-stability", check.ready(in: folder, expected: 1, now: now, isClosed: { _ in closed }) == nil)
 record("complete-closed-file", check.ready(in: folder, expected: 1, now: now.addingTimeInterval(1.1), isClosed: { _ in closed }) == [url.resolvingSymlinksInPath().path])
 record("expected-count", check.ready(in: folder, expected: 2, now: now.addingTimeInterval(2), isClosed: { _ in closed }) == nil)
 let writer = try! FileHandle(forWritingTo: url)
 record("kernel-open-handle", !mailFileIsClosed(url))
 closed = false
 record("open-writer", check.ready(in: folder, expected: 1, now: now.addingTimeInterval(3), isClosed: { _ in closed }) == nil)
 try! writer.close()
 closed = true
 record("closed-again", check.ready(in: folder, expected: 1, now: now.addingTimeInterval(4.1), isClosed: { _ in closed }) == [url.resolvingSymlinksInPath().path])
 let incomplete = text.replacingOccurrences(of: "--test-boundary--\r\n", with: "")
 try! Data(incomplete.utf8).write(to: url)
 _ = check.ready(in: folder, expected: 1, now: now.addingTimeInterval(5), isClosed: { _ in closed })
 record("incomplete-mime", check.ready(in: folder, expected: 1, now: now.addingTimeInterval(6.1), isClosed: { _ in closed }) == nil)
 try! Data("From: test@example.invalid\r\nSubject: Plain\r\n\r\nPlain body.".utf8).write(to: url)
 _ = check.ready(in: folder, expected: 1, now: now.addingTimeInterval(7), isClosed: { _ in closed })
 record("plain-text-closed", check.ready(in: folder, expected: 1, now: now.addingTimeInterval(8.1), isClosed: { _ in closed }) == [url.resolvingSymlinksInPath().path])
 try! FileManager.default.removeItem(at: url)
 try! FileManager.default.createSymbolicLink(at: url, withDestinationURL: URL(fileURLWithPath: "/etc/hosts"))
 record("symlink-rejected", check.ready(in: folder, expected: 1, now: now.addingTimeInterval(9), isClosed: { _ in closed }) == nil)
 let passed = checks.allSatisfy { $0["passed"] as? Bool == true }
 emit(["passed": passed, "cases": checks]);exit(passed ? 0 : 1)
}
if CommandLine.arguments.contains("--materialization-flow-self-test") || CommandLine.arguments.contains("--recover-materialized") {
 let app = NSApplication.shared
 app.setActivationPolicy(.accessory)
 let coordinator = Coordinator()
 let test = CommandLine.arguments.contains("--materialization-flow-self-test")
 let folder: URL, expected: Int, notePath: String, when: String
 if test {
  folder = FileManager.default.temporaryDirectory.appendingPathComponent("obsidian-outlook-" + UUID().uuidString, isDirectory: true)
  try! FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
  for name in ["one", "two"] {
   try! Data(("From: fixture@example.invalid\r\nSubject: " + name + "\r\n\r\nComplete body.\r\n").utf8).write(to: folder.appendingPathComponent(name + ".eml"))
  }
  expected = 2; notePath = "synthetic-native-materialization.md"; when = ISO8601DateFormatter().string(from: Date())
 } else {
  guard CommandLine.arguments.count == 6, let count = Int(CommandLine.arguments[3]), count > 0, count <= 100 else { exit(2) }
  folder = URL(fileURLWithPath: CommandLine.arguments[2]).resolvingSymlinksInPath()
  let root = FileManager.default.temporaryDirectory.resolvingSymlinksInPath()
  guard folder.deletingLastPathComponent().path == root.path,
        folder.lastPathComponent.range(of: "^obsidian-outlook-[A-Fa-f0-9-]+$", options: .regularExpression) != nil else { exit(2) }
  expected = count; notePath = CommandLine.arguments[4]; when = CommandLine.arguments[5]
 }
 let id = UUID(), target = Target(id: "recovery", path: notePath, x: 0, y: 0, width: 100, height: 100)
 coordinator.pendingDrops[id] = (expected, [], [])
 coordinator.dropSources[id] = "apple-mail"
 coordinator.onDrop = { payload in
  let passed = (payload["files"] as? [String])?.count == expected && (payload["errors"] as? [String])?.isEmpty == true && coordinator.materializationTimers.isEmpty
  emit(["event": "materialization-flow-result", "passed": passed, "synthetic": test])
  if test { try? FileManager.default.removeItem(at: folder) }
  exit(passed ? 0 : 1)
 }
 coordinator.watchMaterialized(id, target: target, when: when, destination: folder, expected: expected)
 DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
  emit(["event": "materialization-flow-result", "passed": false, "reason": "Files not complete and closed"])
  if test { try? FileManager.default.removeItem(at: folder) }
  exit(1)
 }
 app.run()
}
let application = NSApplication.shared
application.setActivationPolicy(.accessory)
let coordinator = Coordinator()
coordinator.start()
DispatchQueue.global(qos: .utility).async {
 while let line = readLine() {
  guard let data = line.data(using: .utf8), let message = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
  if let raw = message["targets"], let encoded = try? JSONSerialization.data(withJSONObject: raw), let targets = try? JSONDecoder().decode([Target].self, from: encoded) {
   // Do not trust NaN, enormous rectangles, missing paths or offscreen test containers.
   let valid = targets.filter { !$0.path.isEmpty && $0.x.isFinite && $0.y.isFinite && $0.width > 30 && $0.width < 20000 && $0.height > 30 && $0.height < 20000 }
   DispatchQueue.main.async { coordinator.targets = valid; emit(["event": "targets-updated", "count": valid.count]) }
  }
 }
 DispatchQueue.main.async { application.terminate(nil) }
}
application.run()
