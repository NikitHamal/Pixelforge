"""Nik1 tokenizer: a small, whitespace-preserving word-piece BPE.

Two decisions are load-bearing here:

* **Whitespace is part of the token.** Splitting on ``\\s?word`` (the GPT-2 trick)
  makes ``decode(encode(x)) == x`` exactly. The classic ``word</w>`` style inserts
  a space after every word, which silently turns ``{"tool":"set_color"}`` into
  ``{ "tool" : "set_color" }`` — the router's training targets would have been
  unparseable JSON.
* **Byte fallback.** Every character in the training corpus is a token, and any
  character that is not becomes its UTF-8 bytes (the 256 `<bNN>` tokens). So the
  encoder is *total*: emoji, CJK, a stray control byte, a user's typo in another
  script — all round-trip exactly, and the model just sees a rarer sequence. A
  tokenizer that can fail is a tokenizer that crashes a game.
"""
from __future__ import annotations

import json
import re
from collections import Counter

PAD, BOS, EOS, UNK = "<pad>", "<bos>", "<eos>", "<unk>"
SPECIALS = [PAD, BOS, EOS, UNK]
BYTES = ["<b%d>" % i for i in range(256)]
# a word *with* its leading whitespace, a bare whitespace run, or one symbol
WORD_RE = re.compile(r"\s?[A-Za-z]+|\s?[0-9]+|\s+|[^\sA-Za-z0-9]")


class BPE:
    def __init__(self, merges=None, vocab=None, lowercase: bool = True):
        self.merges = [(a, b) for a, b in (merges or [])]
        self.lowercase = lowercase
        self.vocab = dict(vocab) if vocab else {}
        self.ranks = {p: i for i, p in enumerate(self.merges)}
        self.itos = {}
        self.vocab_size = len(self.vocab)
        if self.vocab:
            self.rebuild()

    def rebuild(self):
        self.itos = {i: t for t, i in self.vocab.items()}
        self.pad, self.bos, self.eos, self.unk = (self.vocab[s] for s in SPECIALS)
        self.byte_ids = [self.vocab[b] for b in BYTES]
        self.id_to_byte = {self.vocab[b]: i for i, b in enumerate(BYTES)}
        self.vocab_size = len(self.vocab)

    # ---------------- training ----------------
    @staticmethod
    def words(text):
        return WORD_RE.findall(text)

    def fit(self, corpus, vocab_size=1024, min_pair_freq=2, verbose=False):
        counts = Counter()
        for line in corpus:
            for w in self.words(line.lower() if self.lowercase else line):
                counts[w] += 1
        splits = {w: tuple(w) for w in counts}
        vocab = {s: i for i, s in enumerate(SPECIALS)}
        for b in BYTES:                     # reserved byte fallback alphabet
            vocab[b] = len(vocab)
        for ch in sorted({c for w in counts for c in w}):
            if ch not in vocab:
                vocab[ch] = len(vocab)
        merges = []
        while len(vocab) < vocab_size:
            pairs = Counter()
            for w, cnt in counts.items():
                sym = splits[w]
                for i in range(len(sym) - 1):
                    pairs[(sym[i], sym[i + 1])] += cnt
            if not pairs:
                break
            (a, b), freq = pairs.most_common(1)[0]
            if freq < min_pair_freq:
                break
            merges.append((a, b))
            merged = a + b
            vocab[merged] = len(vocab)
            for w in splits:
                sym = splits[w]
                if a not in sym:
                    continue
                out, i = [], 0
                while i < len(sym):
                    if i < len(sym) - 1 and sym[i] == a and sym[i + 1] == b:
                        out.append(merged)
                        i += 2
                    else:
                        out.append(sym[i])
                        i += 1
                splits[w] = tuple(out)
        self.merges = merges
        self.vocab = vocab
        self.ranks = {p: i for i, p in enumerate(merges)}
        self.rebuild()
        if verbose:
            print("BPE: %d merges, vocab %d" % (len(merges), len(vocab)))
        return self

    # ---------------- encoding ----------------
    def _encode_word(self, w):
        sym = []
        for ch in w:
            if ch in self.vocab:
                sym.append(ch)
            else:
                sym.extend(BYTES[b] for b in ch.encode("utf-8"))
        if not sym:
            return []
        while len(sym) > 1:
            best, best_rank = None, None
            for i in range(len(sym) - 1):
                r = self.ranks.get((sym[i], sym[i + 1]))
                if r is not None and (best_rank is None or r < best_rank):
                    best, best_rank = (sym[i], sym[i + 1]), r
            if best is None:
                break
            a, b = best
            out, i = [], 0
            while i < len(sym):
                if i < len(sym) - 1 and sym[i] == a and sym[i + 1] == b:
                    out.append(a + b)
                    i += 2
                else:
                    out.append(sym[i])
                    i += 1
            sym = out
        return sym

    def tokenize(self, text):
        if self.lowercase:
            text = text.lower()
        out = []
        for w in self.words(text):
            out.extend(self._encode_word(w))
        return out

    def encode(self, text, add_bos=False, add_eos=False):
        ids = [self.vocab.get(t, self.unk) for t in self.tokenize(text)]
        if add_bos:
            ids = [self.bos] + ids
        if add_eos:
            ids = ids + [self.eos]
        return ids

    def decode(self, ids):
        """Inverse of encode: byte tokens are accumulated and UTF-8 decoded."""
        out, buf = [], bytearray()

        def flush():
            if buf:
                out.append(buf.decode("utf-8", errors="replace"))
                buf.clear()

        for i in ids:
            i = int(i)
            if i in (self.pad, self.bos, self.eos):
                continue
            if i in self.id_to_byte:
                buf.append(self.id_to_byte[i])
            else:
                flush()
                out.append(self.itos.get(i, UNK))
        flush()
        return "".join(out)

    def raw(self, ids):
        """Decode keeping every token — used by the grammar masker."""
        return "".join(self.itos.get(int(i), "") for i in ids)

    # ---------------- persistence ----------------
    def save(self, path):
        with open(path, "w") as fh:
            json.dump({"merges": [[a, b] for a, b in self.merges], "vocab": self.vocab,
                       "lowercase": self.lowercase}, fh)
        return path

    @staticmethod
    def load(path):
        with open(path) as fh:
            d = json.load(fh)
        return BPE(d["merges"], d["vocab"], d.get("lowercase", True))


if __name__ == "__main__":
    corpus = [
        '{"tool":"load_template","args":{"id":"rpg_knight"}}',
        'open rpg knight',
        'give me the skeleton',
        'export a gif at 4x',
    ]
    bpe = BPE().fit(corpus, 160, 1, True)
    ok = True
    for s in corpus + ["open the skeleton", "set color to #ff0044", "unicode \u2728 test"]:
        ids = bpe.encode(s, add_bos=True, add_eos=True)
        rt = bpe.decode(ids)
        good = rt == (s.lower() if bpe.lowercase else s)
        ok &= good
        print("%s %r -> %d ids -> %r" % ("OK " if good else "BAD", s, len(ids), rt))
    print("lossless" if ok else "LOSSY")
