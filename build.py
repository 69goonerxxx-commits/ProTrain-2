#!/usr/bin/env python3
"""Builds the single-file index.html from src/.   Usage:  python3 build.py [--check]
Source order: src/head.html, src/styles.css, src/body.html, src/NN-*.js (sorted), src/tail.html.
The result is one self-contained file, so it still opens anywhere (including from a file manager)."""
import os,re,subprocess,sys,tempfile
ROOT=os.path.dirname(os.path.abspath(__file__));SRC=os.path.join(ROOT,'src')
JS=sorted(f for f in os.listdir(SRC) if re.match(r'\d\d-.*\.js$',f))
def rd(n):return open(os.path.join(SRC,n),encoding='utf-8').read()
def build():
    js=''.join(rd(f) for f in JS)
    out=rd('head.html')+'<style>\n'+rd('styles.css')+'</style>\n'+rd('body.html')+'<script>\n'+js+'</script>\n'+rd('tail.html')
    open(os.path.join(ROOT,'index.html'),'w',encoding='utf-8').write(out)
    return js
def check(js):
    with tempfile.TemporaryDirectory() as t:
        a=os.path.join(t,'a.js');open(a,'w',encoding='utf-8').write(js)
        if subprocess.run(['node','--check',a]).returncode:sys.exit('SYNTAX ERROR')
        data=js[js.index('var ID_ALIASES'):js.index('var DAYS_SHORT')]+js[js.index('var AWAY_MAP'):js.index('function isAwayModeActive')]
        code="var localStorage={getItem:function(){return null}};"+data+"""
var bad=[],ids={};
function seen(id,where){if(ids[id])bad.push('duplicate id '+id+' ('+where+')');ids[id]=1;}
Object.keys(EX).forEach(function(d){EX[d].forEach(function(e){seen(e.id,d);if(!e.muscles||!e.steps||!e.target)bad.push('incomplete '+e.id);});});
Object.keys(SUBS).forEach(function(k){if(!ALL_EX.some(function(e){return e.id===k}))bad.push('SUBS for unknown id '+k);SUBS[k].forEach(function(a){seen(a.id,'alt of '+k);});});
Object.keys(AWAY_MAP).forEach(function(k){if(!(SUBS[k]||[]).some(function(a){return a.name===AWAY_MAP[k]}))bad.push('AWAY_MAP target missing '+k);});
Object.keys(ID_ALIASES).forEach(function(k){if(!ids[ID_ALIASES[k]])bad.push('alias target missing '+k);});
console.log(bad.length?bad.join('\\n'):'program data OK ('+Object.keys(ids).length+' ids)');process.exit(bad.length?1:0);"""
        b=os.path.join(t,'b.js');open(b,'w',encoding='utf-8').write(code)
        if subprocess.run(['node',b]).returncode:sys.exit('PROGRAM DATA ERROR')
if __name__=='__main__':
    js=build();print('built index.html');
    if '--check' in sys.argv:check(js);print('checks passed')
