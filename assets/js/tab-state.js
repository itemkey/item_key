(function(){
  'use strict';

  const STORAGE_KEY = 'ik_tab_state_v1';

  function getPageId(){
    const page = document.body?.dataset?.i18nPage;
    if(page) return page;
    const path = window.location.pathname;
    const match = path.match(/\/([^\/]+)\.html$/);
    return match ? match[1] : 'unknown';
  }

  function getStoredState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    }catch(e){
      return {};
    }
  }

  function saveState(pageId, state){
    try{
      const all = getStoredState();
      all[pageId] = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    }catch(e){}
  }

  function getState(pageId){
    const all = getStoredState();
    return all[pageId] || null;
  }

  let registeredTabs = null;
  let currentState = {};

  window.IKTabState = {
    registerTabs: function(tabGroups){
      registeredTabs = tabGroups;
    },

    setActive: function(group, tabId){
      if(!registeredTabs) return;
      const pageId = getPageId();
      if(!currentState[pageId]) currentState[pageId] = {};
      currentState[pageId][group] = tabId;
      saveState(pageId, currentState[pageId]);
    },

    getActive: function(group){
      const pageId = getPageId();
      const state = getState(pageId);
      if(!state) return null;
      return state[group] || null;
    },

    goBack: function(){
      const pageId = getPageId();
      const state = getState(pageId);
      if(!state || Object.keys(state).length === 0){
        window.history.back();
        return;
      }

      if(registeredTabs && registeredTabs.main){
        const mainTab = state.main;
        if(mainTab && window.StudentHelperTabs){
          window.StudentHelperTabs.setMainTab(mainTab);
        }
      }

      if(registeredTabs && registeredTabs.wt_sub){
        const wtTab = state.wt_sub;
        if(wtTab && window.StudentHelperTabs && window.StudentHelperTabs.setWTSubTab){
          window.StudentHelperTabs.setWTSubTab(wtTab);
        }
      }

      if(registeredTabs && registeredTabs.onoi_notes){
        const activeNote = state.activeNote;
        if(activeNote){
          setTimeout(() => {
            const event = new CustomEvent('ik:restoreNote', { detail: { noteId: activeNote } });
            document.dispatchEvent(event);
          }, 100);
        }
      }
    },

    init: function(){
      const pageId = getPageId();
      currentState[pageId] = getState(pageId) || {};
    }
  };

  document.addEventListener('DOMContentLoaded', function(){
    window.IKTabState.init();
  });
})();
