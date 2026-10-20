H=https://brief-2026-10-21.photoczaro-models.pages.dev
slugs="akanksha-rattan amina-olzhabassova andrey esso joya-maria-al-asmar karla-sandoval nataliia olivia tasneem-raza"
bad=0; n=0
for l in fr ru es cs ar; do
  exp_dir=ltr; [ $l = ar ] && exp_dir=rtl
  for s in $slugs; do
    h=$(curl -s "$H/$l/models/$s" | grep -o '<html[^>]*>' | head -1); n=$((n+1))
    case "$h" in *"lang=\"$l\""*"dir=\"$exp_dir\""*) ;; *) bad=$((bad+1)); echo "BAD $l/$s: $h";; esac
    if [ $l = ar ]; then case "$h" in *"rtl"*"rtl"*|*'class="rtl"'*) ;; *) echo "NO rtl class $l/$s: $h";; esac; fi
  done
done
echo "checked $n translated profile pages, mismatches: $bad"
