from pathlib import Path
import re

EDITOR = Path('mobile/src/ConnectDisplayPage.tsx')
editor = EDITOR.read_text(encoding='utf-8')

if 'HASSOUN_DISPLAY_EDITOR_RESUME_V1' not in editor:
    storage_anchor = 'const STORAGE_KEY="hassoun:paired-displays:v2";'
    if storage_anchor not in editor:
        raise SystemExit('v1032 editor resume: STORAGE_KEY missing')
    editor = editor.replace(
        storage_anchor,
        storage_anchor + '\nconst EDITOR_STATE_KEY="hassoun:display-editor-state:v1"; // HASSOUN_DISPLAY_EDITOR_RESUME_V1',
        1,
    )

# Track whether paired displays have finished restoring so we do not decide that the
# saved display is missing before AsyncStorage has loaded the paired list.
state_line = 'const [code,setCode]=useState("")'
if state_line not in editor:
    raise SystemExit('v1032 editor resume: state block missing')
if 'pairedLoaded' not in editor:
    editor = editor.replace(
        'const [code,setCode]=useState("")',
        'const [pairedLoaded,setPairedLoaded]=useState(false);\n  const [code,setCode]=useState("")',
        1,
    )

# Existing paired-display restoration now marks itself complete even when nothing is saved.
old_effect = 'useEffect(()=>{void AsyncStorage.getItem(STORAGE_KEY).then(v=>{if(v)try{setPaired(JSON.parse(v))}catch{}});return()=>{if(saveTimer.current)clearTimeout(saveTimer.current)}},[]);'
new_effect = 'useEffect(()=>{void AsyncStorage.getItem(STORAGE_KEY).then(v=>{if(v)try{setPaired(JSON.parse(v))}catch{}finally{setPairedLoaded(true)}else setPairedLoaded(true)});return()=>{if(saveTimer.current)clearTimeout(saveTimer.current)}},[]);'
if old_effect in editor:
    editor = editor.replace(old_effect, new_effect, 1)
elif 'setPairedLoaded(true)' not in editor:
    raise SystemExit('v1032 editor resume: paired restore effect changed unexpectedly')

# Persist the exact nested editor selection. This is intentionally small and does not
# duplicate the remote layout settings themselves; those are saved by the tablet layout
# persistence patch and remote server.
open_editor_anchor = 'const openEditor=async(item:Display)=>{setActive(item);setBusy(true);try{setRemote(await loadRemote(item))}catch(e){Alert.alert("Display",e instanceof Error?e.message:"Could not load display")}finally{setBusy(false)}};'
if open_editor_anchor not in editor:
    raise SystemExit('v1032 editor resume: openEditor declaration missing')
new_open = 'const openEditor=async(item:Display)=>{setActive(item);void AsyncStorage.setItem(EDITOR_STATE_KEY,JSON.stringify({activeId:item.id,selected}));setBusy(true);try{setRemote(await loadRemote(item))}catch(e){Alert.alert("Display",e instanceof Error?e.message:"Could not load display")}finally{setBusy(false)}};'
editor = editor.replace(open_editor_anchor, new_open, 1)

# Restore exact editor page after process recreation / returning from background. The
# remote config is reloaded from the server instead of showing a blank/restarted page.
if 'restoreSavedDisplayEditor' not in editor:
    restore_effect = '''\n  useEffect(()=>{\n    if(!pairedLoaded||active)return;\n    let cancelled=false;\n    const restoreSavedDisplayEditor=async()=>{\n      try{\n        const raw=await AsyncStorage.getItem(EDITOR_STATE_KEY);\n        if(!raw||cancelled)return;\n        const saved=JSON.parse(raw) as {activeId?:string;selected?:Part};\n        const parts:Part[]=["page","meta","clock","card","arabic","english","time","adhan","mini"];\n        if(saved.selected&&parts.includes(saved.selected))setSelected(saved.selected);\n        if(saved.activeId){\n          const item=paired.find(x=>x.id===saved.activeId);\n          if(item){\n            setActive(item);setBusy(true);\n            try{setRemote(await loadRemote(item))}catch{}finally{if(!cancelled)setBusy(false)}\n          }\n        }\n      }catch{}\n    };\n    void restoreSavedDisplayEditor();\n    return()=>{cancelled=true};\n  },[pairedLoaded,paired,active]);\n\n  useEffect(()=>{\n    if(!active)return;\n    void AsyncStorage.setItem(EDITOR_STATE_KEY,JSON.stringify({activeId:active.id,selected}));\n  },[active?.id,selected]);\n'''
    insert_after = new_open
    editor = editor.replace(insert_after, insert_after + restore_effect, 1)

# Back from the live editor should deliberately clear only the nested editor target so
# a normal user Back action stays respected. Backgrounding/foregrounding does not clear it.
old_back = 'onPress={()=>{setActive(null);setRemote(null)}}'
new_back = 'onPress={()=>{setActive(null);setRemote(null);void AsyncStorage.setItem(EDITOR_STATE_KEY,JSON.stringify({activeId:null,selected}))}}'
if old_back in editor:
    editor = editor.replace(old_back, new_back, 1)
elif new_back not in editor:
    raise SystemExit('v1032 editor resume: live editor back button missing')

for marker in [
    'HASSOUN_DISPLAY_EDITOR_RESUME_V1',
    'hassoun:display-editor-state:v1',
    'restoreSavedDisplayEditor',
    'pairedLoaded',
    'activeId:active.id',
]:
    if marker not in editor:
        raise SystemExit(f'v1032 editor resume missing marker: {marker}')

EDITOR.write_text(editor, encoding='utf-8')
print('HASSOUN_DISPLAY_EDITOR_RESUME_V1 applied: exact Tablet/iPad admin editor and selected section restore after background/process recreation')
