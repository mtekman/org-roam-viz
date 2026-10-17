;;; org-roam-viz.el --- Vizualisation -*- lexical-binding: t; -*-

;; Copyright (C) 2026 Mehmet Tekman <mtekman89@gmail.com>

;; Author: Mehmet Tekman
;; URL: https://github.com/mtekman/org-roam-viz.el
;; Keywords: outlines
;; Package-Requires: ((emacs "26.1") (dash "2.17.0") (org "9.1.6"))
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

;;; Export nodes and edges from the org-roam sqlite database, and
;;; render interactively.

;;; Method to the madness: Build node_modules and public HTML, 
;;; 


(defcustom org-roam-db-file org-roam-db-location
  "Location of the org-roam sqlite3 database."
  :group 'org-roam-viz
  :type 'string)

(defcustom org-roam-viz-viewer (executable-find "firefox")
  "Method to view the org-roam-viz graph.
It may be one of the following:
  - a string representing the path to the executable for viewing the graph.
  - a function accepting a single argument: the graph file path.
  - nil uses `view-file' to view the graph."
  :type '(choice
          (string   :tag "Path to executable")
          (function :tag "Function to display graph" eww-open-file)
          (const    :tag "view-file"))
  :group 'org-roam)

(defcustom org-roam-viz-port 3000
  "Port to host the page"
  :type 'integer)

(defvar org-roam-viz--buffer "*org-roam-viz*"
  "org-roam-viz message buffer")

(defun org-roam-viz--open ()
  "Open localhost:port using `org-roam-viz-viewer'."
  (let ((page "http://localhost:3000"))
    (pcase org-roam-viz-viewer
      ((pred stringp)
       (if (executable-find org-roam-viz-viewer)
           (condition-case err
               (call-process org-roam-viz-viewer nil 0 nil page)
             (error (user-error "Failed to open org-roam-viz graph: %s" err)))
         (user-error "Executable not found: \"%s\"" org-roam-viz-viewer)))
      ((pred functionp) (funcall org-roam-viz-viewer page))
      (_ (signal 'wrong-type-argument `((functionp stringp null) ,org-roam-viz-viewer))))))

(defun org-roam-viz--get-install-dir()
  (let ((dir "~/repos/_mtekman/org-brain-viz/"))
    dir))

(defvar org-roam-viz--install-dir (org-roam-viz--get-install-dir))

;; --- Node and NPM related functions
(defun org-roam-viz-init ()
  "Install node modules and build public facing HTML."
  (interactive)  
  (org-roam-viz--npm-initialise-node-modules)
  (org-roam-viz--npm-build-page))

(defvar org-roam-viz--serve-process nil)

(defun org-roam-viz--npm-command-async (&rest commandlist)
  "Run an NPM async command in the package directory."
  (setq org-roam-viz--serve-process
        (let ((default-directory org-roam-viz--install-dir))
          (apply #'start-process "npm-procname"
                 org-roam-viz--buffer "npm" commandlist))))

(defun org-roam-viz--npm-command-async-kill ()
  "Kill the async command"
  (kill-process org-roam-viz--serve-process)
  (setq org-roam-viz--serve-process nil))

(defun org-roam-viz--npm-command (&rest commandlist)
  "Run an NPM command in the package directory."
  (let ((default-directory org-roam-viz--install-dir))
    (apply #'call-process "npm" nil
           org-roam-viz--buffer nil commandlist)))

(defun org-roam-viz--npm-initialise-node-modules ()
  "Install the npm package's dependencies in a central location"
  (org-roam-viz--npm-command "install" ".")
  (message "org-roam-viz: Populated node modules at '%s'"
           (concat org-roam-viz--install-dir "node_modules")))

(defun org-roam-viz--npm-build-page ()
  "Use esbuild to compile the page components into a single serving HTML."
    (org-roam-viz--npm-command "run" "page-build")
    (message "org-roam-viz: Public HTML compiled to '%s'"
             (concat org-roam-viz--install-dir "public")))
;; ---

;; Graph related functions
(defun org-roam-viz-regenerate ()
  "Generate nodes and edges from the sqlite file"
  (interactive)
  (org-roam-viz--npm-command "run" "graph-build" "--" org-roam-db-file)
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
  (org-roam-viz--npm-command-async-kill))

(defun org-roam-viz-start ()
  "Render the graph of nodes and edges"
  (interactive)
  (org-roam-viz--npm-command-async
   "run" "page-serve" "--" "-l" (format "%s" org-roam-viz-port))
  (with-current-buffer org-roam-viz--buffer
    (goto-char (buffer-end 1))
    (let* ((network-host
            (progn (re-search-backward
                    (rx " - Network: " (+ space)
                        (group "http://" (+ (not space)) ":" (+ num)) (+ space)))
                   (match-string 1)))
           (local-host
            (progn (re-search-backward
                    (rx " - Local: " (+ space)
                        (group "http://" (+ (not space)) ":" (+ num)) (+ space)))
                   (match-string 1))))
      ;;(list local-host network-host)))
      (message (concat "org-roam-viz: Now serving on `%s' and `%s'\n"
                       "              Run `org-roam-viz-stop' to finish")
               local-host network-host))))

