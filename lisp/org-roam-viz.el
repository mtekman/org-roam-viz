;;; org-roam-viz.el --- Vizualisation -*- lexical-binding: t; -*-

;; Copyright (C) 2026 Mehmet Tekman <mtekman89@gmail.com>

;; Author: Mehmet Tekman <mtekman89@gmail.com>
;; URL: https://github.com/mtekman/org-roam-viz
;; Keywords: outlines
;; Package-Requires: ((emacs "28.1") (org-roam "2.3.1"))
;; Version: 0.1

;;; License:

;; This program is free software; you can redistribute it and/or modify
;; it under the terms of the GNU General Public License as published by
;; the Free Software Foundation, either version 3 of the License, or
;; (at your option) any later version.

;; This program is distributed in the hope that it will be useful,
;; but WITHOUT ANY WARRANTY; without even the implied warranty of
;; MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
;; GNU General Public License for more details.

;;; Commentary:

;; Export nodes and edges from the org-roam sqlite database, and
;; render them interactively in an HTML page.

;;; Code:

(require 'org-roam-db)

(defcustom org-roam-viz-db-file org-roam-db-location
  "Location of the org-roam sqlite3 database."
  :group 'org-roam-viz
  :type 'string)

(defcustom org-roam-viz-port 3000
  "Port to host the page."
  :group 'org-roam-viz
  :type 'integer)

(defun org-roam-viz--get-install-dir ()
  "Get the installation directory.  Works with straight for now."
  (let* ((fname-elc (symbol-file 'org-roam-viz-port))
         (fname-el (string-replace ".elc" ".el" fname-elc))
         (fname-symlink (file-truename fname-el))
         (install-dir (split-string fname-symlink "lisp")))
    (car install-dir)))

(defvar org-roam-viz--buffer "*org-roam-viz*"
  "Org-roam-viz message buffer.")
(defvar org-roam-viz--serve-process nil
  "Async webpage process.")

;; --- Node and NPM related functions
(defun org-roam-viz-init ()
  "Install node modules and build public facing HTML."
  (interactive)
  (org-roam-viz--npm-initialise-node-modules)
  (org-roam-viz--npm-build-page))

(defun org-roam-viz--npm-command-async (&rest commandlist)
  "Run an NPM async command in the package directory.
Optional argument COMMANDLIST expands arguments to npm."
  (setq org-roam-viz--serve-process
        (let ((default-directory (org-roam-viz--get-install-dir)))
          (apply #'start-process "npm-procname"
                 org-roam-viz--buffer "npm" commandlist))))

(defun org-roam-viz--npm-command-async-kill ()
  "Kill the async command."
  (kill-process org-roam-viz--serve-process)
  (setq org-roam-viz--serve-process nil))

(defun org-roam-viz--npm-command (&rest commandlist)
  "Run an NPM command in the package directory.
Optional argument COMMANDLIST expands arguments to npm."
  (let ((default-directory (org-roam-viz--get-install-dir)))
    (apply #'call-process "npm" nil
           org-roam-viz--buffer nil commandlist)))

(defun org-roam-viz--npm-initialise-node-modules ()
  "Install the npm package's dependencies in a central location."
  (org-roam-viz--npm-command "install" ".")
  (message "org-roam-viz: Populated node modules at '%s'"
           (concat (org-roam-viz--get-install-dir) "node_modules")))

(defun org-roam-viz--npm-build-page ()
  "Use esbuild to compile the page components into a single serving HTML."
  (org-roam-viz--npm-command "run" "page-build")
  (message "org-roam-viz: Public HTML compiled to '%s'"
           (concat (org-roam-viz--get-install-dir) "public")))
;; ---

;; Graph related functions
(defun org-roam-viz-regenerate ()
  "Generate nodes and edges from the sqlite file."
  (interactive)
  (org-roam-viz--sanity-check)
  (org-roam-viz--npm-command "run" "graph-build" "--" org-roam-viz-db-file)
  (with-current-buffer org-roam-viz--buffer
    (goto-char (buffer-end 1))
    (re-search-backward (rx bol "Wrote "
                            (group (+ num)) " nodes and "
                            (group (+ num)) " edges to "
                            (group (+ (not space)))))
    (let ((nodes (match-string 1))
          (edges (match-string 2))
          (publish-dir (match-string 3)))
      (message (concat "org-roam-viz: Nodes (%d) and Edges (%d) at %s"
                       "\n              %s")
               (string-to-number nodes) (string-to-number edges) publish-dir
               (if org-roam-viz--serve-process
                   "Please refresh the page to see new changes"
                 "Run `org-roam-viz-start` to start rendering.")))))

(defun org-roam-viz-stop ()
  "Stop rendering."
  (interactive)
  (org-roam-viz--npm-command-async-kill)
  (message "org-roam-viz: visualization stopped"))

(defun org-roam-viz--sanity-check (&rest graphtoo)
  "Check that all files are populated, and that existing instances are terminated.
Optional argument GRAPHTOO to include existence of generated nodes and edges."
  (let* ((inst-dir (org-roam-viz--get-install-dir))
         (pub-dir (file-name-concat inst-dir "public"))
         (node-modules-p (file-exists-p (file-name-concat inst-dir "node_modules")))
         (public-html-p (file-exists-p  (file-name-concat pub-dir "index.html")))
         (public-nodes-p (file-exists-p (file-name-concat pub-dir "nodes.json")))
         (public-edges-p (file-exists-p (file-name-concat pub-dir "edges.json"))))
    (if (or (not public-html-p) (not node-modules-p))
        (user-error "org-roam-viz: Not initialised, need to run `org-roam-viz-init' at least once"))
    (if graphtoo
        (if (or (not public-nodes-p) (not public-edges-p))
            (user-error "org-roam-viz: Graph not generated, run `org-roam-viz-regenerate'")))))

(defun org-roam-viz--wait-for-hosts (&optional timeout)
  "Wait until org-roam-viz buffer contains Network2 and Local2 URLs.
TIMEOUT is seconds to wait; defaults to 15."
  (let ((deadline (+ (float-time) (or timeout 15)))
        (count 0)
        network-host local-host)
    (while (and (< (float-time) deadline)
                (or (null network-host)
                    (null local-host)))
      (with-current-buffer org-roam-viz--buffer
        (goto-char (point-min))
        (setq network-host
              (when (re-search-forward
                     (rx " - Network: " (+ space)
                         (group "http://" (+ (not space)) ":" (+ num)))
                     nil t)
                (match-string 1)))
        (goto-char (point-min))
        (setq local-host
              (when (re-search-forward
                     (rx " - Local: " (+ space)
                         (group "http://" (+ (not space)) ":" (+ num)))
                     nil t)
                (match-string 1))))
      (unless (and network-host local-host)
        ;; Let timers/process output run, then wait 0.5 seconds.
        (setq count (1+ count))
        (message "org-roam-viz: Waiting for server... %d" count)
        (accept-process-output nil 0.5)
        (sit-for 0.5)))
    (if (and network-host local-host)
        (message (concat "org-roam-viz: Now serving on `%s' and `%s'\n"
                         "              Run `org-roam-viz-stop' to finish")
                 local-host network-host)
      (message "org-roam-viz: Timed out waiting for server URLs"))))


(defun org-roam-viz-start ()
  "Render the graph of nodes and edges."
  (interactive)
  (if org-roam-viz--serve-process
      (message (concat "org-roam-viz: Already running on port %d\n"
                       "              Remember to stop the server with `org-roam-viz-stop'")
               org-roam-viz-port)
    ;; Run:
    (org-roam-viz--sanity-check t)
    (org-roam-viz--npm-command-async
     "run" "page-serve" "--" "-l" (format "%s" org-roam-viz-port))
    (org-roam-viz--wait-for-hosts)))

(provide 'org-roam-viz)
;;; org-roam-viz.el ends here
