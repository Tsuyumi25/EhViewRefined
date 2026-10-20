# Integrating with Eh View Refined

[繁體中文](integration.zh_TW.md)

Everything below is plain DOM, so it reads the same from any script or sandbox. Eh View Refined only describes what it draws: nothing here needs a script to register with it or tell it anything first. It does follow what widely used scripts for the site do to the page, such as copying tags back to the text the site served when a translation script has already rewritten them, so those scripts keep working on the views it draws. Lists are JSON, single values are plain strings, and a value that does not exist leaves its attribute out. Attributes and their meanings are only ever added to, so read leniently: ignore fields and values you do not know.

## Detecting Eh View Refined

While the script runs, the root `<html>` element carries `data-evr-version` with its version. It is set at `document-start` on every page the script matches, so scripts that run later can read it directly.

```js
const evrVersion = document.documentElement.getAttribute('data-evr-version') // null when not running
```

## Reading All Tags

Each gallery item's `data-evr-tags` attribute contains a JSON array of all its tags the site lists, which is every tag with enough power to be searched. Each entry includes `name` (the original tag name) and `tier`, the site's own class for how settled the tag is: `gt` (confirmed), `gtl` (many votes, not yet confirmed) or `gtw` (little weight). In case the site ever changes these classes, treat a `tier` you do not know as an unrecognised tier. Hiding tags does not affect this data.

```js
const galleries = Array.from(
  document.querySelectorAll('[data-evr-tags]'),
  element => ({
    element,
    tags: JSON.parse(element.getAttribute('data-evr-tags')),
  }),
)
```

## Reading the Uploader

Each gallery item's `data-evr-uploader` attribute contains the uploader's name, decoded from the uploader link. It is present in every view, including Thumbnail, whose layout shows no uploader. Items whose row has no uploader link have no attribute.

```js
const uploader = element.getAttribute('data-evr-uploader') // null without an uploader link
```

## Finding Tags by Name

Every tag drawn in a listing, in any view including Extended, carries `data-evr-tag` with its original name and `data-evr-ns` with its namespace; a tag the site files under no namespace has no `data-evr-ns`. The element keeps the site's classes and holds the tag text as its only child, so a script can restyle it in place without adding nodes.

Unless the reader turns off **Show the uploader among the tags** (on by default), each gallery with an uploader gets one more tag-shaped element with the class `evr-uploader-tag`, `data-evr-tag="uploader:<name>"` and `data-evr-ns="uploader"`. It is not part of `data-evr-tags`. With **One row per namespace**, the simulated views group tags into the namespace rows Extended shows, in the same order, and the uploader gets the last row.

```js
const tags = document.querySelectorAll('[data-evr-tag]')
const name = tags[0].getAttribute('data-evr-tag') // e.g. "uploader:<name>" for the uploader tag
```

## Watching New Galleries

Each page of galleries, including those infinite scrolling loads, is inserted into the listing in one batch, so once the document has loaded a `MutationObserver` on the listing sees one `childList` record per page. A page inserted while the document is still loading is followed by one more record for each tag, whose text is added again after the batch, so translation scripts that only read the nodes added to them still see every tag.

## Galleries Outside the Window

With infinite scrolling on, galleries far from the viewport stay in the document but are not drawn: they carry the class `evr-parked`, which sets `display: none`. Nodes, references and form inputs inside them stay as they were, and the class is removed when they come back near the viewport. Two `.evr-window-spacer` elements next to the listing hold the height of the parked galleries.

## Reading the Rating

Each gallery item's `data-evr-rating` attribute contains the average rating its stars show, in half-star steps from `0` to `5`. Once the user has rated a gallery, the site's stars show the user's own rating instead; such items carry it in `data-evr-my-rating` and have no `data-evr-rating`, since the listing no longer shows the average.

```js
const rating = element.getAttribute('data-evr-rating') // e.g. "4.5"
const myRating = element.getAttribute('data-evr-my-rating') // set only when the user has rated it
```

## Sending Search Requests in Extended Mode

Once users install this script and use its simulated views, the site's view mode stays in Extended. Other scripts can send search requests in Extended mode to retrieve complete tags. Eh View Refined handles the displayed layout, so those requests leave the user's chosen simulated view unchanged.

## Opening the Settings

Dispatching `evr:open-settings` on `document` opens the Eh View Refined settings, on any page where `data-evr-version` is present. The listener is in place from `document-start`. The event carries no data, so a plain `Event` works from any sandbox. When the settings close, focus returns to the element that had it when the event was dispatched, which is usually the button that sent it.

```js
if (document.documentElement.hasAttribute('data-evr-version')) {
  document.dispatchEvent(new Event('evr:open-settings'))
}
```
